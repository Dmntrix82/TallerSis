const { query } = require("../config/db");

async function listarPorTurno(turnoId) {
  const { rows } = await query(
    `SELECT * FROM caja.movimientos WHERE turno_id = $1 ORDER BY id`,
    [turnoId]
  );
  return rows;
}

async function insertar({ caja_id, turno_id, tipo, metodo, monto, origen_microservicio, referencia_externa, descripcion }) {
  const { rows } = await query(
    `INSERT INTO caja.movimientos
       (caja_id, turno_id, tipo, metodo, monto, origen_microservicio, referencia_externa, descripcion)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [caja_id, turno_id, tipo, metodo, monto, origen_microservicio || "LOCAL", referencia_externa || null, descripcion || null]
  );
  return rows[0];
}

module.exports = { listarPorTurno, insertar };