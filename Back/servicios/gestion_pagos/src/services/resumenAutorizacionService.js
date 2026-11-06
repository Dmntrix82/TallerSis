const { AppError } = require("../utils/AppError");
const { aCentavos, aMonto } = require("../utils/money");
const repo = require("../data/resumenAutorizacionRepo");

/**
 * TDSI-195: resumen de la factura que ve el supervisor en la ventana "Autorizacion de
 * supervisor" antes de escribir su PIN (anulacion o modificacion).
 * - numero_factura: el N° que ve el cajero en "Facturas" (VTA-000054).
 * - items: las ventas de caja no guardan detalle por producto (no hay catalogo y el
 *   formulario de "Pagos" solo pide el monto), asi que se arma un solo item con el
 *   total de la venta; items_detallados = false lo deja claro.
 */
async function obtenerResumenAutorizacion(id_transaccion) {
  const filas = await repo.filasDeVenta(String(id_transaccion || "").trim());
  if (filas.length === 0) throw new AppError("Transaccion no encontrada.", 404);

  const primera = filas[0];
  const totalC = filas.reduce((acc, f) => acc + aCentavos(f.monto), 0);
  const total = aMonto(totalC);

  return {
    numero_factura: primera.id_transaccion,
    fecha: primera.fecha,
    estado: primera.estado,
    cliente: primera.razon_social || "Consumidor final",
    razon_social: primera.razon_social,
    tipo_documento: primera.tipo_documento,
    nit: primera.nit,
    telefono: primera.telefono,
    total,
    tipo_pago: primera.tipo_pago,
    metodos: filas.map((f) => f.metodo),
    detalle_metodos: filas.map((f) => ({ metodo: f.metodo, monto: f.monto })),
    cajero: primera.cajero,
    caja_id: primera.caja_id,
    items: [{ descripcion: "Venta", cantidad: 1, precio_unitario: total, subtotal: total }],
    items_detallados: false,
  };
}

module.exports = { obtenerResumenAutorizacion };
