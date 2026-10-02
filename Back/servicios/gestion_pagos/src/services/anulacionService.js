const { AppError } = require("../utils/AppError");
const repo = require("../data/ventasOnlineRepo");
const { notificarAnulacionExterna } = require("./notificacionProxy");

// TDSI-367: Recibe la solicitud de anulación del sistema cliente y la deja como PENDIENTE
async function anularPagoOnline({ ordenId, motivo, solicitadoPor }) {
  if (!ordenId) throw new AppError("El campo 'ordenId' es obligatorio", 400);
  if (!motivo || String(motivo).trim().length < 5) throw new AppError("Debe indicar un motivo de anulación de al menos 5 caracteres", 400);

  const venta = await repo.obtenerVenta(ordenId);
  if (!venta) throw new AppError("La orden que intenta anular no existe", 404, { ordenId });
  // TDSI-368: Validar que no haya sido despachada antes de permitir anular
  if (venta.despachada) throw new AppError("No se puede anular: la compra ya fue despachada", 409, { ordenId });
  
  if (venta.estado === 'Anulado') {
    throw new AppError("El pago de esta orden ya fue anulado anteriormente", 409, { ordenId });
  }
  if (venta.estado === 'Anulacion Pendiente') {
    throw new AppError("Ya existe una solicitud de anulación pendiente para esta orden", 409, { ordenId });
  }

  // 1. Persistencia de la solicitud (TDSI-369 parcial: queda en revisión)
  const anulacion = await repo.guardarSolicitudAnulacion({
    ordenId: venta.orden_id,
    motivo: String(motivo).trim(),
    solicitadoPor
  });

  return { 
    anulacionRecibida: true, 
    ordenId,
    estado: "Anulacion Pendiente",
    detalle: anulacion,
    mensaje: "Solicitud de anulación recibida y pendiente de revisión por el administrador."
  };
}

async function listarAnulacionesPendientes() {
  return await repo.listarSolicitudesPendientes();
}

async function procesarSolicitudAnulacion(idSolicitud, accion) {
  if (!['APROBADA', 'RECHAZADA'].includes(accion)) {
    throw new AppError("Acción inválida. Debe ser APROBADA o RECHAZADA.", 400);
  }

  // Se actualiza en la BD
  const result = await repo.procesarAnulacion(idSolicitud, accion);
  
  // TDSI-370: Si fue aprobada, notificar al sistema cliente
  let notificado = false;
  if (accion === 'APROBADA') {
    notificado = await notificarAnulacionExterna(result.ordenId, result.motivo);
    if (notificado) {
      await repo.marcarAnulacionNotificada(result.ordenId);
    }
  }

  return {
    procesado: true,
    ordenId: result.ordenId,
    accion,
    notificado,
    mensaje: accion === 'APROBADA' && notificado 
      ? "Anulación aprobada y sistema cliente notificado" 
      : `Solicitud ${accion.toLowerCase()} correctamente`
  };
}

module.exports = { anularPagoOnline, listarAnulacionesPendientes, procesarSolicitudAnulacion };