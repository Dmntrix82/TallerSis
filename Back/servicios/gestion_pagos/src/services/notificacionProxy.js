// Usamos la variable de entorno que inyectaste, o un fallback
const FACTURACION_URL = process.env.FACTURACION_URL || 'http://localhost:4002';

async function notificarAnulacionExterna(ordenId, motivo) {
  try {
    // Usamos fetch nativo de Node.js
    const response = await fetch(`${FACTURACION_URL}/api/webhooks/anulaciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ordenId, motivo, estado: 'ANULADO' })
    });
    
    return response.ok;
  } catch (error) {
    // Si el sistema cliente está caído, no rompemos el proceso, solo logueamos
    console.error(`[NotificacionProxy] Error al notificar al sistema cliente (Orden: ${ordenId}):`, error.message);
    return false;
  }
}

module.exports = { notificarAnulacionExterna };