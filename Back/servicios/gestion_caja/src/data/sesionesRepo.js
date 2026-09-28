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

module.exports = { insertarSesion, cerrarInactivas };
