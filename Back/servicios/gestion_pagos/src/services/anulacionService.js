const { AppError } = require("../utils/AppError");
const repo = require("../data/ventasOnlineRepo");
const { notificarAnulacionExterna } = require("./notificacionProxy");

async function anularPagoOnline({ ordenId, motivo, solicitadoPor }) {
  if (!ordenId) throw new AppError("El campo 'ordenId' es obligatorio", 400);
  if (!motivo || String(motivo).trim().length < 5) throw new AppError("Debe indicar un motivo de anulación de al menos 5 caracteres", 400);

  const venta = await repo.obtenerVenta(ordenId);
  if (!venta) throw new AppError("La orden que intenta anular no existe", 404, { ordenId });
  if (venta.despachada) throw new AppError("No se puede anular: la compra ya fue despachada", 409, { ordenId });
  
  if (venta.estado === 'Anulado') {
    throw new AppError("El pago de esta orden ya fue anulado anteriormente", 409, { ordenId });
  }

  // 1. Persistencia (TDSI-369)
  const anulacion = await repo.guardarAnulacion({
    ordenId: venta.orden_id,
    motivo: String(motivo).trim(),
    solicitadoPor
  });

  // 2. Notificación al Sistema Cliente (TDSI-370)
  const notificadoExitomente = await notificarAnulacionExterna(venta.orden_id, anulacion.motivo);
  
  if (notificadoExitomente) {
    await repo.marcarAnulacionNotificada(venta.orden_id);
    anulacion.notificado = true;
  }

  return { 
    anulacionRecibida: true, 
    ordenId,
    estado: "ANULADO",
    detalle: anulacion,
    mensaje: notificadoExitomente ? "Pago anulado y sistema notificado" : "Pago anulado (Notificación pendiente/fallida)"
  };
}

module.exports = { anularPagoOnline };