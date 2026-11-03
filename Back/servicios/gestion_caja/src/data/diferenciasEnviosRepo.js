const { query } = require("../config/db");

/**
 * TDSI-52/698/700: registra el intento de envio a Contabilidad (Pendiente), con el
 * mensaje ya armado. Si ya existia (dos resoluciones no deberian pasar, pero por las
 * dudas) no lo pisa -- una diferencia tiene a lo sumo un envio.
 */
async function crearPendiente(diferenciaId, payload) {
  const { rows } = await query(
    `INSERT INTO caja.diferencias_envios_contabilidad (diferencia_id, payload)
     VALUES ($1, $2)
     ON CONFLICT (diferencia_id) DO NOTHING
     RETURNING *`,
    [diferenciaId, payload]
  );
  return rows[0] || null;
}

/** TDSI-698: Pub/Sub confirmo que guardo el mensaje. */
async function marcarEnviado(diferenciaId, pubsubMessageId) {
  const { rows } = await query(
    `UPDATE caja.diferencias_envios_contabilidad
        SET estado = 'Enviado', intentos = intentos + 1, pubsub_message_id = $2,
            enviado_en = now(), ultimo_error = NULL
      WHERE diferencia_id = $1
      RETURNING *`,
    [diferenciaId, pubsubMessageId]
  );
  return rows[0] || null;
}

/** TDSI-698/701: Pub/Sub no respondio (o Contabilidad no esta configurada) -- se puede reintentar. */
async function marcarError(diferenciaId, error) {
  const { rows } = await query(
    `UPDATE caja.diferencias_envios_contabilidad
        SET intentos = intentos + 1, ultimo_error = $2
      WHERE diferencia_id = $1
      RETURNING *`,
    [diferenciaId, String(error || "").slice(0, 400)]
  );
  return rows[0] || null;
}

async function obtenerPorDiferencia(diferenciaId) {
  const { rows } = await query(`SELECT * FROM caja.diferencias_envios_contabilidad WHERE diferencia_id = $1`, [diferenciaId]);
  return rows[0] || null;
}

/**
 * TDSI-700: guarda el resultado que mando Contabilidad (Confirmado/Rechazado + motivo).
 * Solo si el envio seguia abierto (Pendiente/Enviado) -- una respuesta que llega dos
 * veces no pisa un resultado que ya se asento.
 */
async function registrarResultado(diferenciaId, { estado, motivo }) {
  const { rows } = await query(
    `UPDATE caja.diferencias_envios_contabilidad
        SET estado = $2, motivo_rechazo = $3, respondido_en = now()
      WHERE diferencia_id = $1 AND estado IN ('Pendiente', 'Enviado')
      RETURNING *`,
    [diferenciaId, estado, motivo || null]
  );
  return rows[0] || null;
}

module.exports = { crearPendiente, marcarEnviado, marcarError, obtenerPorDiferencia, registrarResultado };
