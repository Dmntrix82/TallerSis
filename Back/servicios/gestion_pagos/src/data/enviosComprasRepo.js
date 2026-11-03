const { query } = require("../config/db");

/**
 * TDSI-54/682/697: registra el envio del reporte de esa fecha (Enviado). Si ya existia
 * (reenvio tras Error) actualiza la misma fila -- una fecha tiene a lo sumo un envio.
 */
async function registrarEnviado(fecha, { reporteId, payload, messageId }) {
  const { rows } = await query(
    `INSERT INTO pagos.envios_compras (fecha, reporte_id, estado, intentos, payload, pubsub_message_id, enviado_en)
     VALUES ($1, $2, 'Enviado', 1, $3, $4, now())
     ON CONFLICT (fecha) DO UPDATE
       SET estado = 'Enviado', intentos = pagos.envios_compras.intentos + 1,
           payload = EXCLUDED.payload, pubsub_message_id = EXCLUDED.pubsub_message_id,
           enviado_en = now(), ultimo_error = NULL
     RETURNING *`,
    [fecha, reporteId, payload, messageId]
  );
  return rows[0];
}

/** Pub/Sub no respondio -- se puede reintentar ("salvo que el envio haya quedado en Error"). */
async function registrarError(fecha, { reporteId, payload, error }) {
  const { rows } = await query(
    `INSERT INTO pagos.envios_compras (fecha, reporte_id, estado, intentos, payload, ultimo_error)
     VALUES ($1, $2, 'Error', 1, $3, $4)
     ON CONFLICT (fecha) DO UPDATE
       SET estado = 'Error', intentos = pagos.envios_compras.intentos + 1,
           payload = EXCLUDED.payload, ultimo_error = EXCLUDED.ultimo_error
     RETURNING *`,
    [fecha, reporteId, payload, String(error || "").slice(0, 400)]
  );
  return rows[0];
}

async function obtenerPorFecha(fecha) {
  const { rows } = await query(`SELECT * FROM pagos.envios_compras WHERE fecha = $1`, [fecha]);
  return rows[0] || null;
}

/**
 * TDSI-697: Compras confirmo por "compras-acuses" -- solo si el envio no estaba ya
 * Recibido (una acuse repetida no pisa la fecha en que se recibio la primera vez).
 */
async function marcarRecibido(fecha) {
  const { rows } = await query(
    `UPDATE pagos.envios_compras SET estado = 'Recibido', recibido_en = now() WHERE fecha = $1 AND estado <> 'Recibido' RETURNING *`,
    [fecha]
  );
  return rows[0] || null;
}

module.exports = { registrarEnviado, registrarError, obtenerPorFecha, marcarRecibido };
