const repo = require("../data/enviosContabilidadRepo");
const { publicar } = require("../clients/pubsubPublisher");
const cfg = require("../config/contabilidad");

function err(mensaje, status = 400, detalle = null) {
  const e = new Error(mensaje);
  e.status = status;
  e.detalle = detalle;
  return e;
}

const TIPOS = { venta: "FACTURA_VENTA", anulacion: "FACTURA_ANULACION" };
const ESTADOS = ["Pendiente", "Enviado", "Error"];
const num = (v) => Math.round(Number(v || 0) * 100) / 100;

// Fecha del documento en hora de Bolivia (YYYY-MM-DD): una factura de las 22:00 es de ese dia, no del siguiente.
const fechaBolivia = (v) => new Date(v).toLocaleDateString("en-CA", { timeZone: "America/La_Paz" });

const MOTIVO_MINIMO = 10; // Contabilidad rechaza anulaciones con motivo mas corto

/**
 * TDSI-22: mensajes de factura en el formato que pide el Modulo de Contabilidad (Grupo D).
 * Contabilidad lee solo el cuerpo y sistema_origen debe ser exactamente "FACTURACION".
 *  - venta: referencia_externa = numero de la factura, con los datos para el asiento.
 *  - anulacion: tipo_operacion "anulacion_factura" y referencia propia ("ANU-" + numero; si se
 *    repitiera el numero de la venta lo tomarian como duplicado), apuntando a la venta original.
 */
function armarMensaje({ factura, tipo, anulacion = null }) {
  if (tipo === "anulacion") {
    return {
      sistema_origen: "FACTURACION",
      referencia_externa: `ANU-${factura.numero}`,
      tipo_operacion: "anulacion_factura",
      fecha_documento: fechaBolivia(anulacion?.autorizado_en || new Date()),
      datos: {
        id_documento_original: factura.numero,
        tipo_documento_original: "venta",
        motivo: String(anulacion?.motivo || "").trim(),
      },
    };
  }

  const fecha = fechaBolivia(factura.fecha);
  return {
    sistema_origen: "FACTURACION",
    referencia_externa: factura.numero,
    tipo_operacion: "venta",
    fecha_documento: fecha,
    datos: {
      fecha_documento: fecha,
      nit_cliente: factura.cliente_nit ?? null,
      nombre_cliente: factura.cliente_nombre || "Consumidor final",
      monto: num(factura.total),
      condicion_pago: "contado",
      costo_venta: 0, // no hay catalogo de productos con costo
      monto_descuento: num(factura.descuento),
      modo_impuesto: "incluido", // IVA incluido en el precio
    },
  };
}

/**
 * Un intento de publicacion; deja registrado el resultado.
 * Contabilidad solo acepta la anulacion si la venta ya le llego: mientras la venta no este
 * Enviado, la anulacion espera (sin gastar intentos) y el worker la vuelve a revisar.
 */
async function intentarEnvio(envio) {
  if (envio.tipo === "anulacion") {
    const venta = await repo.obtenerPorFactura(envio.factura_id, "venta");
    if (!venta || venta.estado !== "Enviado") {
      return repo.posponer(envio.id, cfg.BACKOFF_BASE_SEG, "Esperando que la venta llegue a Contabilidad");
    }
  }

  const payload = envio.payload || (await repo.obtener(envio.id, { conPayload: true })).payload;
  const r = await publicar(payload, {
    tipo: TIPOS[envio.tipo],
    tipo_operacion: payload.tipo_operacion,
    factura_id: envio.factura_id,
    referencia_externa: payload.referencia_externa,
    idempotency_key: `factura-${envio.factura_id}-${envio.tipo}`,
    origen: "facturacion",
    grupo: "A",
  });
  if (r.ok) return repo.marcarEnviado(envio.id, r.messageId);
  return repo.registrarFallo(envio.id, r, cfg.MAX_INTENTOS, cfg.BACKOFF_BASE_SEG);
}

/**
 * Registra y publica el envio 'venta' o 'anulacion' de una factura.
 * Cada factura se envia una sola vez por tipo: si ya existe se devuelve ese envio sin publicar de nuevo.
 * Al anular una factura cuya venta nunca se envio, primero se envia la venta.
 * Sin topico configurado no registra nada (desarrollo local sin credenciales).
 */
async function enviarFactura(facturaId, tipo) {
  if (!TIPOS[tipo]) throw err(`El tipo de envio debe ser: ${Object.keys(TIPOS).join(", ")}.`);
  if (!cfg.PUBSUB_TOPIC) return { publicado: false, motivo: "CONTABILIDAD_PUBSUB_TOPIC no esta configurado" };

  const factura = await repo.datosFactura(facturaId);
  if (!factura) throw err(`La factura ${facturaId} no existe.`, 404);

  let anulacion = null;
  if (tipo === "anulacion") {
    anulacion = await repo.anulacionAutorizada(facturaId);
    if (factura.estado !== "Anulada" || !anulacion)
      throw err(`La factura ${factura.numero} no tiene una anulacion autorizada.`, 409);
    if (String(anulacion.motivo || "").trim().length < MOTIVO_MINIMO)
      throw err(`Contabilidad exige un motivo de anulacion de al menos ${MOTIVO_MINIMO} caracteres.`, 422);
    if (!(await repo.obtenerPorFactura(factura.id, "venta"))) await enviarFactura(factura.id, "venta");
  }

  const payload = armarMensaje({ factura, tipo, anulacion });
  const { envio, yaExiste } = await repo.crear({ facturaId: factura.id, tipo, payload });
  if (yaExiste) return yaExiste;
  // El primer intento publica el mensaje tal como se armo (JSONB reordena las claves al guardarlo).
  return intentarEnvio({ ...envio, payload });
}

/**
 * Para emitir/anular: nunca hace fallar la operacion principal. Si algo sale mal lo
 * informa en { error } y el worker (o "reenviar") se encarga despues.
 */
async function enviarFacturaSeguro(facturaId, tipo) {
  try {
    return await enviarFactura(facturaId, tipo);
  } catch (e) {
    console.error(`[contabilidad] No se pudo enviar la ${tipo} de la factura ${facturaId}:`, e.message);
    return { publicado: false, error: e.message };
  }
}

async function listarEnvios({ estado, tipo, limite } = {}) {
  const estadoFiltro = estado ? ESTADOS.find((e) => e.toLowerCase() === String(estado).toLowerCase()) : null;
  if (estado && !estadoFiltro) throw err(`El estado debe ser uno de: ${ESTADOS.join(", ")}.`, 400, { estado });
  const tipoFiltro = tipo ? String(tipo).toLowerCase() : null;
  if (tipoFiltro && !TIPOS[tipoFiltro]) throw err(`El tipo debe ser: ${Object.keys(TIPOS).join(", ")}.`, 400, { tipo });
  const lim = limite === undefined || limite === "" ? 50 : Number(limite);
  if (!Number.isInteger(lim) || lim < 1 || lim > 200) throw err("El 'limite' debe ser un entero entre 1 y 200.", 400, { limite });

  const envios = await repo.listar({ estado: estadoFiltro, tipo: tipoFiltro, limite: lim });
  return { total: envios.length, envios };
}

/** "Reenviar" un envio en Error: nuevo ciclo de intentos y un intento inmediato. */
async function reenviarEnvio(id) {
  const limpio = String(id ?? "").trim();
  if (!/^\d{1,18}$/.test(limpio) || Number(limpio) === 0) throw err("El id del envio debe ser un numero entero positivo.");
  const envio = await repo.prepararReenvio(limpio);
  if (!envio) {
    const actual = await repo.obtener(limpio);
    if (!actual) throw err(`El envio ${id} no existe.`, 404);
    throw err(`Solo se pueden reenviar envios con estado Error (este esta ${actual.estado}).`, 409, { envio: actual });
  }
  return intentarEnvio(envio);
}

module.exports = { armarMensaje, enviarFactura, enviarFacturaSeguro, intentarEnvio, listarEnvios, reenviarEnvio };
