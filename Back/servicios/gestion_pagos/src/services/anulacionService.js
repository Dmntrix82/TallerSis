const { AppError } = require("../utils/AppError");
const repo = require("../data/ventasOnlineRepo");

async function anularPagoOnline({ ordenId, motivo, solicitadoPor }) {
  if (!ordenId) {
    throw new AppError("El campo 'ordenId' es obligatorio", 400);
  }
  if (!motivo || String(motivo).trim().length < 5) {
    throw new AppError("Debe indicar un motivo de anulación de al menos 5 caracteres", 400);
  }

  const venta = await repo.obtenerVenta(ordenId);
  if (!venta) {
    throw new AppError("La orden que intenta anular no existe", 404, { ordenId });
  }

  // NUEVO: Validación de despacho para TDSI-368
  if (venta.despachada) {
    throw new AppError("No se puede anular: la compra ya fue despachada", 409, { ordenId });
  }

  console.log(`[anulacion] Solicitud válida (no despachada) para orden ${ordenId}. Motivo: ${motivo}`);
  
  return { 
    anulacionRecibida: true, 
    ordenId,
    mensaje: "Solicitud de anulación validada (orden no despachada)"
  };
}

module.exports = { anularPagoOnline };