const { query } = require("../config/db");

async function listarPorTurno(turnoId) {
  const { rows } = await query(
    `SELECT * FROM caja.movimientos WHERE turno_id = $1 ORDER BY id`,
    [turnoId]
  );
  return rows;
}

module.exports = { listarPorTurno };