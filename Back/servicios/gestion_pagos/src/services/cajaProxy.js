// Puente hacia gestion_caja. Alimenta caja.movimientos despues de un pago exitoso,
// segun el diagrama de arquitectura ("Actualiza Resumen de Caja").
const GESTION_CAJA_URL = process.env.GESTION_CAJA_URL || "http://localhost:4004";

async function notificarMovimientoCaja({ turnoId, cajaId, tipo, metodo, monto, referenciaExterna, descripcion }) {
  if (!turnoId) return { enviado: false, motivo: "sin turnoId" };
  try {
    const r = await fetch(`${GESTION_CAJA_URL}/api/caja/turnos/${turnoId}/movimientos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo, metodo, monto,
        origen_microservicio: "PAGOS",
        referencia_externa: referenciaExterna,
        descripcion,
      }),
    });
    return { enviado: r.status === 201 };
  } catch (e) {
    // Si gestion_caja esta caido, el pago igual se registra -- no bloqueamos el cobro por esto.
    console.error("No se pudo notificar a gestion_caja:", e.message);
    return { enviado: false, motivo: e.message };
  }
}

module.exports = { notificarMovimientoCaja };