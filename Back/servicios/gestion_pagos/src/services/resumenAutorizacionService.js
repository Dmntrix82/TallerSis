const { AppError } = require("../utils/AppError");
const { aCentavos, aMonto } = require("../utils/money");
const repo = require("../data/resumenAutorizacionRepo");

// TDSI-905: mismo largo que pagos.transacciones.id_transaccion.
const ID_MAX = 60;

/**
 * TDSI-195: resumen de la factura que ve el supervisor en la ventana "Autorizacion de
 * supervisor" antes de escribir su PIN (anulacion o modificacion).
 * - numero_factura: el N° que ve el cajero en "Facturas" (VTA-000054).
 * - items: las ventas de caja no guardan detalle por producto (no hay catalogo y el
 *   formulario de "Pagos" solo pide el monto), asi que se arma un solo item con el
 *   total de la venta; items_detallados = false lo deja claro.
 * - motivo (TDSI-903): el que escribio el cajero al pedir la anulacion, si esta pendiente.
 * - datos_actuales (TDSI-904): los datos de facturacion tal como estan guardados ahora,
 *   para mostrarlos al lado de los nuevos cuando se pide una modificacion; con las
 *   modificaciones anteriores de la bitacora.
 * - cajero: el de la sesion. Igual que en "Facturas" (TDSI-866), solo puede ver el resumen
 *   el cajero que emitio la venta; asi no se pueden leer los datos de clientes de otras
 *   cajas probando numeros de factura.
 */
async function obtenerResumenAutorizacion(id_transaccion, { cajero } = {}) {
  const id = String(id_transaccion || "").trim();
  if (!id || id.length > ID_MAX) {
    throw new AppError("El N° de factura no es valido.", 400, { id_transaccion: id.slice(0, 20) });
  }
  if (Array.isArray(cajero) || !cajero || !String(cajero).trim()) {
    throw new AppError("Falta identificar al cajero para ver el resumen de la factura.", 400);
  }
  const filas = await repo.filasDeVenta(id);
  // TDSI-905: 404 con un mensaje que el supervisor entienda, sin mostrar una vista previa vacia.
  if (filas.length === 0) {
    throw new AppError(`La factura ${id} no existe.`, 404, { id_transaccion: id });
  }
  const delCajero = (valor) => String(valor || "").trim().toLowerCase();
  if (delCajero(filas[0].cajero) !== delCajero(cajero)) {
    throw new AppError("Solo el cajero que emitio esta factura puede ver su resumen.", 403, { id_transaccion: id });
  }
  if (filas.every((f) => f.estado === "Anulado")) {
    throw new AppError(`La factura ${id} ya esta anulada: no se puede anular ni modificar.`, 404, { id_transaccion: id, estado: "Anulado" });
  }
  const [solicitud, modificaciones] = await Promise.all([
    repo.solicitudAnulacionPendiente(id),
    repo.modificacionesAnteriores(id),
  ]);

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
    motivo: solicitud ? solicitud.motivo : null,
    solicitud: solicitud
      ? { motivo: solicitud.motivo, solicitado_por: solicitud.solicitado_por, solicitado_en: solicitud.solicitado_en }
      : null,
    datos_actuales: {
      tipo_documento: primera.tipo_documento,
      nit: primera.nit,
      razon_social: primera.razon_social,
      telefono: primera.telefono,
    },
    modificaciones_anteriores: modificaciones,
  };
}

module.exports = { obtenerResumenAutorizacion };
