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
const iso = (v) => (v instanceof Date ? v.toISOString() : v ?? null);

/**
 * TDSI-22: mensaje de una factura para Contabilidad (Grupo D).
 * tipo 'venta' al emitirse y 'anulacion' al autorizarse su anulacion; los dos llevan la
 * factura completa para que Contabilidad pueda registrar o revertir el asiento.
 * IVA incluido en el precio (Bolivia): base imponible = total, IVA = total x porcentaje.
 */
function armarMensaje({ factura, tipo, anulacion = null, ivaPorcentaje = 13, emitidoEn = new Date() }) {
  const total = num(factura.total);
  const iva = Number(factura.impuesto) > 0 ? num(factura.impuesto) : num((total * ivaPorcentaje) / 100);

  const mensaje = {
    tipo: TIPOS[tipo],
    version: 1,
    id_mensaje: `factura-${factura.id}-${tipo}`,
    origen: "TALLERSIS_FACTURACION",
    envio: { tipo },
    empresa: cfg.EMPRESA,
    factura: {
      id: Number(factura.id),
      numero: factura.numero,
      fecha_emision: iso(factura.fecha),
      estado: factura.estado,
      canal: factura.canal,
      venta_id: factura.venta_id ?? null,
      con_factura: factura.con_factura,
      cuf: factura.cuf ?? null,
      codigo_control: factura.codigo_control ?? null,
      moneda: "BOB",
    },
    cliente: {
      nit: factura.cliente_nit ?? null,
      razon_social: factura.cliente_nombre || "Consumidor final",
    },
    items: (factura.items || []).map((i) => ({
      descripcion: i.descripcion,
      cantidad: num(i.cantidad),
      precio_unitario: num(i.precio_unitario),
      subtotal: num(i.subtotal),
    })),
    metodos_pago: (factura.metodosPago || []).map((m) => ({ metodo: m.metodo, monto: num(m.monto) })),
    totales: {
      subtotal: num(factura.subtotal),
      descuento: num(factura.descuento),
      total,
      base_imponible: total,
      iva: { porcentaje: num(ivaPorcentaje), monto: iva },
    },
    emitido_en: emitidoEn.toISOString(),
  };

  if (tipo === "anulacion") {
    mensaje.anulacion = anulacion && {
      id: Number(anulacion.id),
      motivo: anulacion.motivo,
      solicitado_por: anulacion.solicitado_por,
      solicitado_en: iso(anulacion.solicitado_en),
      autorizado_por: anulacion.autorizado_por,
      autorizado_nombre: anulacion.autorizado_nombre,
      autorizado_en: iso(anulacion.autorizado_en),
      observacion: anulacion.observacion ?? null,
    };
  }
  return mensaje;
}

/** Un intento de publicacion; deja registrado el resultado. */
async function intentarEnvio(envio) {
  const payload = envio.payload || (await repo.obtener(envio.id, { conPayload: true })).payload;
  const r = await publicar(payload, {
    tipo: payload.tipo,
    envio_tipo: payload.envio?.tipo,
    factura_id: payload.factura?.id,
    factura_numero: payload.factura?.numero,
    idempotency_key: payload.id_mensaje,
    origen: "facturacion",
    grupo: "A",
  });
  if (r.ok) return repo.marcarEnviado(envio.id, r.messageId);
  return repo.registrarFallo(envio.id, r, cfg.MAX_INTENTOS, cfg.BACKOFF_BASE_SEG);
}

/**
 * Registra y publica el envio 'venta' o 'anulacion' de una factura.
 * Cada factura se envia una sola vez por tipo: si ya existe se devuelve ese envio sin publicar de nuevo.
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
  }

  const payload = armarMensaje({ factura, tipo, anulacion, ivaPorcentaje: await repo.porcentajeIva() });
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
