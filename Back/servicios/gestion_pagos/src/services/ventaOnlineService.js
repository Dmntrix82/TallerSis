const repo = require("../data/ventasOnlineRepo");
const { aCentavos, aMonto } = require("../utils/money");
const { validarFormatoDocumento } = require("../utils/documento");
const { emitirActualizacion } = require("../utils/tableroEvents");
const { emitirFactura } = require("./facturacionProxy");

const METODOS_VALIDOS = ["Efectivo", "Tarjeta", "QR"];

function generarCodigo() {
  return "CNF-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
}

/**
 * TDSI-51/179: valida una venta del Marketplace (misma logica que el pago en mostrador:
 * items + total matematicamente consistentes, NIT/CI con el formato boliviano) y la guarda.
 * Lanza un Error normal (no AppError: esto no responde a un HTTP, lo atrapa el job del
 * topico) con un mensaje claro de por que el mensaje no se pudo procesar.
 */
async function recibirVenta(json) {
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    throw new Error("El mensaje debe ser un objeto JSON");
  }
  if (!json.ordenId || !String(json.ordenId).trim()) {
    throw new Error("El campo 'ordenId' es obligatorio");
  }

  const tipoDocumento = json.tipoDocumento || "NIT";
  const errorFormato = validarFormatoDocumento(tipoDocumento, json.nit);
  if (errorFormato) throw new Error(errorFormato);

  if (!Array.isArray(json.items) || json.items.length === 0) {
    throw new Error("La venta debe tener al menos un ítem");
  }

  const metodoPago = json.metodoPago || "QR";
  if (!METODOS_VALIDOS.includes(metodoPago)) {
    throw new Error(`El método de pago debe ser uno de: ${METODOS_VALIDOS.join(", ")}`);
  }

  // TDSI-344 (reusada): validar que el total coincida con la suma matematica de los items.
  const sumaC = json.items.reduce((acc, it) => acc + aCentavos(it.cantidad * it.precioUnitario), 0);
  if (sumaC !== aCentavos(json.total || 0)) {
    throw new Error(`El total (${json.total}) no coincide con la suma de los ítems (${aMonto(sumaC)})`);
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

  return { ordenId: venta.orden_id, duplicada: false, venta, numeroFactura, facturaError };
}

module.exports = { recibirVenta };
