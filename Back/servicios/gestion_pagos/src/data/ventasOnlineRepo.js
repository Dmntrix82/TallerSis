const { query, withTransaction } = require("../config/db");

async function existeOrden(ordenId) {
  const { rows } = await query(`SELECT 1 FROM pagos.ventas_online WHERE orden_id = $1`, [ordenId]);
  return rows.length > 0;
}

module.exports = { existeOrden };