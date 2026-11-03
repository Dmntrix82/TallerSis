const repo = require("../data/ventasOnlineRepo");
const { aCentavos, aMonto } = require("../utils/money");
const { validarFormatoDocumento } = require("../utils/documento");
const { emitirActualizacion } = require("../utils/tableroEvents");
const { emitirFactura } = require("./facturacionProxy");
const { avisarFacturaEmitida } = require("./avisoMarketplaceService");
const { AppError } = require("../utils/AppError");

const METODOS_VALIDOS = ["Efectivo", "Tarjeta", "QR"];
// El CHECK de pagos.ventas_online.estado permite estos 3 valores. Las nuevas ventas
// solo llegan en 'Pagado' (recibirVenta no genera 'Anulacion Pendiente' -- esa funcion
// se elimino del sistema), pero el filtro acepta los 3 para no rechazar datos historicos.
const ESTADOS_VALIDOS = ["Pagado", "Anulacion Pendiente", "Anulado"];

function generarCodigo() {
  return "CNF-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
}

/**
 * TDSI-51/179/685: valida una venta del Marketplace (misma logica que el pago en
 * mostrador: items + total matematicamente consistentes, NIT/CI con el formato
 * boliviano) y la guarda. Se llama tanto desde el topico (TDSI-179, el job solo lee
 * e.message) como desde el POST /online protegido con JWT (TDSI-685) -- por eso lanza
 * AppError (con status) y no un Error a secas: asi el endpoint HTTP responde 400 con un
 * mensaje claro en vez de un 500 generico.
 */
async function recibirVenta(json) {
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    throw new AppError("El mensaje debe ser un objeto JSON", 400);
  }
  if (!json.ordenId || !String(json.ordenId).trim()) {
    throw new AppError("El campo 'ordenId' es obligatorio", 400);
  }

  const tipoDocumento = json.tipoDocumento || "NIT";
  const errorFormato = validarFormatoDocumento(tipoDocumento, json.nit);
  if (errorFormato) throw new AppError(errorFormato, 400);

  if (!Array.isArray(json.items) || json.items.length === 0) {
    throw new AppError("La venta debe tener al menos un ítem", 400);
  }

  const metodoPago = json.metodoPago || "QR";
  if (!METODOS_VALIDOS.includes(metodoPago)) {
    throw new AppError(`El método de pago debe ser uno de: ${METODOS_VALIDOS.join(", ")}`, 400);
  }

  // TDSI-344 (reusada): validar que el total coincida con la suma matematica de los items.
  const sumaC = json.items.reduce((acc, it) => acc + aCentavos(it.cantidad * it.precioUnitario), 0);
  if (sumaC !== aCentavos(json.total || 0)) {
    throw new AppError(`El total (${json.total}) no coincide con la suma de los ítems (${aMonto(sumaC)})`, 422);
  }

  const itemsProcesados = json.items.map((it) => ({
    sku: it.sku,
    descripcion: it.descripcion || it.sku,
    cantidad: Number(it.cantidad),
    precioUnitario: Number(it.precioUnitario),
    subtotal: aMonto(aCentavos(it.cantidad * it.precioUnitario)),
  }));

  const venta = await repo.guardarVenta(
    {
      ordenId: String(json.ordenId).trim(),
      clienteId: json.cliente || json.clienteId || null,
      nit: String(json.nit).trim(),
      tipoDocumento,
      razonSocial: json.razonSocial || json.cliente || null,
      total: json.total,
      metodoPago,
      codigoConfirmacion: generarCodigo(),
    },
    itemsProcesados
  );

  // TDSI-51: "una orden = una venta", aunque el mensaje llegue dos veces -- no es un error,
  // simplemente no hay nada nuevo que guardar.
  if (!venta) return { ordenId: json.ordenId, duplicada: true };

  emitirActualizacion();

  // TDSI-51/683: la venta ya quedo guardada (lo de arriba, TDSI-179) -- si facturacion
  // no responde, la venta NO se pierde ni se reprocesa: el error queda en la propia fila
  // para poder revisarlo, en vez de tratar esto como si el mensaje del topico fuera invalido.
  let numeroFactura = null;
  let facturaError = null;
  try {
    const factura = await emitirFactura({
      nit: venta.nit,
      razon_social: venta.razon_social || venta.cliente_id,
      items: itemsProcesados.map((it) => ({ descripcion: it.descripcion, cantidad: it.cantidad, precio_unitario: it.precioUnitario })),
    });
    numeroFactura = factura.numero;
    await repo.guardarNumeroFactura(venta.id, numeroFactura);
  } catch (e) {
    facturaError = e.message;
    await repo.guardarErrorFactura(venta.id, facturaError);
  }

  // TDSI-51/684: sin factura no hay nada que avisar todavia -- se avisa cuando
  // la factura SI se pudo emitir.
  let aviso = null;
  if (numeroFactura) {
    aviso = await avisarFacturaEmitida({ id: venta.id, orden_id: venta.orden_id, numero_factura: numeroFactura });
  }

  return { ordenId: venta.orden_id, duplicada: false, venta, numeroFactura, facturaError, aviso };
}

/**
 * TDSI-51/686: listado real para "Ventas Online" del Administrador, con filtros
 * opcionales por fecha (desde/hasta, "YYYY-MM-DD") y estado ("Pagado"/"Anulado").
 * "hasta" incluye el dia completo, igual que listarMisFacturas/totalesGenerales.
 */
async function listarVentas({ desde, hasta, estado } = {}) {
  const desdeFecha = desde ? new Date(`${desde}T00:00:00`) : null;
  const hastaFecha = hasta ? new Date(`${hasta}T23:59:59.999`) : null;
  if (desde && Number.isNaN(desdeFecha?.getTime())) {
    throw new AppError('El parametro "desde" no es una fecha valida.', 400);
  }
  if (hasta && Number.isNaN(hastaFecha?.getTime())) {
    throw new AppError('El parametro "hasta" no es una fecha valida.', 400);
  }
  if (estado && !ESTADOS_VALIDOS.includes(estado)) {
    throw new AppError(`El estado debe ser uno de: ${ESTADOS_VALIDOS.join(", ")}.`, 400);
  }

  return repo.listarVentas({ desde: desdeFecha, hasta: hastaFecha, estado: estado || null });
}

module.exports = { recibirVenta, listarVentas };
