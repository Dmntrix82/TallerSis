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

module.exports = { insertarSesion };
