const { AppError } = require("../utils/AppError");
const repo = require("../data/ventasOnlineRepo");

/** TDSI-367: Servicio que recibe y valida la solicitud inicial de anulación */
async function anularPagoOnline({ ordenId, motivo, solicitadoPor }) {
  // Validaciones nativas
  if (!ordenId) {
    throw new AppError("El campo 'ordenId' es obligatorio", 400);
  }
  if (!motivo || String(motivo).trim().length < 5) {
    throw new AppError("Debe indicar un motivo de anulación de al menos 5 caracteres", 400);
  }

  // Verificar que la orden exista en la BD
  const venta = await repo.obtenerVenta(ordenId);
  if (!venta) {
    throw new AppError("La orden que intenta anular no existe", 404, { ordenId });
  }

  console.log(`[anulacion] Solicitud válida recibida para la orden ${ordenId}. Motivo: ${motivo}`);
  
  return { 
    anulacionRecibida: true, 
    ordenId,
    mensaje: "Solicitud de anulación recibida correctamente"
  };
}

module.exports = { anularPagoOnline };