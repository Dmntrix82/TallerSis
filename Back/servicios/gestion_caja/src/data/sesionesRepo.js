const { query } = require("../config/db");

async function insertarSesion({ cajero_id, cajero_nombre, caja_id }) {
  const resultado = await query(
    `INSERT INTO caja.sesiones_cajero (cajero_id, cajero_nombre, caja_id)
     VALUES ($1, $2, $3)
     RETURNING id, cajero_id, cajero_nombre, caja_id, iniciada_en, activa`,
    [cajero_id, cajero_nombre, caja_id]
  );
  return resultado.rows[0];
}

async function cerrarInactivas(minutos) {
  const resultado = await query(
    `UPDATE caja.sesiones_cajero
     SET activa = false, cerrada_en = now(), cierre_automatico = true
     WHERE activa = true AND iniciada_en < now() - ($1 || ' minutes')::interval
     RETURNING id, cajero_id, caja_id, iniciada_en`,
    [minutos]
  );
  return resultado.rows;
}
/** TDSI-852: bloquea la sesión. */
async function bloquearSesion(id) {
  const { rows } = await query(
    `UPDATE caja.sesiones_cajero
        SET bloqueada_en = now(), intentos_desbloqueo = 0
      WHERE id = $1 AND activa = true
      RETURNING *`,
    [id]
  );
  return rows[0] || null;
}

/** TDSI-852: desbloquea la sesión. */
async function desbloquearSesion(id) {
  const { rows } = await query(
    `UPDATE caja.sesiones_cajero
        SET desbloqueada_en = now(), bloqueada_en = NULL, intentos_desbloqueo = 0
      WHERE id = $1
      RETURNING *`,
    [id]
  );
  return rows[0] || null;
}

/** TDSI-851: incrementa el contador de intentos fallidos. */
async function incrementarIntentos(id) {
  const { rows } = await query(
    `UPDATE caja.sesiones_cajero
        SET intentos_desbloqueo = intentos_desbloqueo + 1
      WHERE id = $1
      RETURNING intentos_desbloqueo`,
    [id]
  );
  return rows[0] ? rows[0].intentos_desbloqueo : 0;
}

/** TDSI-851: cierra la sesión (al 3er intento fallido). */
async function cerrarSesion(id) {
  const { rows } = await query(
    `UPDATE caja.sesiones_cajero
        SET activa = false, cerrada_en = now(), cierre_automatico = true
      WHERE id = $1
      RETURNING *`,
    [id]
  );
  return rows[0] || null;
}

/** TDSI-852: obtiene la sesión activa de un cajero. */
async function obtenerSesionActiva(cajero_id) {
  const { rows } = await query(
    `SELECT * FROM caja.sesiones_cajero
      WHERE cajero_id = $1 AND activa = true
      ORDER BY iniciada_en DESC
      LIMIT 1`,
    [cajero_id]
  );
  return rows[0] || null;
}

module.exports = { 
  insertarSesion, 
  cerrarInactivas, 
  bloquearSesion, 
  desbloquearSesion, 
  incrementarIntentos, 
  cerrarSesion, 
  obtenerSesionActiva 
};
