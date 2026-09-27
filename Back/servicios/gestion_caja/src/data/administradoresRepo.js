const { query } = require("../config/db");

async function buscarPorCajeroId(cajero_id) {
  const { rows } = await query(
    "SELECT id, cajero_id, nombre, activo FROM caja.administradores WHERE cajero_id = $1",
    [cajero_id]
  );
  return rows[0] || null;
}

module.exports = { buscarPorCajeroId };
