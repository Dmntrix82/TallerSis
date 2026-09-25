const { query } = require("../config/db");

async function obtenerTurnoPorId(turnoId) {
  const { rows } = await query(`SELECT * FROM caja.turnos WHERE id = $1`, [turnoId]);
  return rows[0] || null;
}

module.exports = { obtenerTurnoPorId };