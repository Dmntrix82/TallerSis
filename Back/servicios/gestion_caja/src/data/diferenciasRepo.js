const { query } = require("../config/db");
const num = (v) => (v === null || v === undefined ? v : Number(v));

/** Normaliza la fila (monto a number, id a number) */
function normalizar(r) {
  if (!r) return null;
  return { ...r, id: num(r.id), turno_id: num(r.turno_id), monto: num(r.monto) };
}

/** TDSI-487: registra una diferencia al cerrar el turno */
async function insertar({ turno_id, monto, tipo }) {
  const { rows } = await query(
    `INSERT INTO caja.diferencias_resolucion (turno_id, monto, tipo, estado)
     VALUES ($1, $2, $3, 'PENDIENTE')
     RETURNING *`,
    [turno_id, monto, tipo]
  );
  return normalizar(rows[0]);
}

/** TDSI-492: diferencias registradas en un conjunto de turnos. */
async function listarPorTurnos(turnoIds) {
  if (!turnoIds.length) return [];
  const { rows } = await query(
    `SELECT id, turno_id, monto, tipo, estado, justificacion, resuelta_por, resuelta_en
       FROM caja.diferencias_resolucion
      WHERE turno_id = ANY($1::bigint[])
      ORDER BY turno_id, id`,
    [turnoIds]
  );
  return rows.map(normalizar);
}

module.exports = { listarPorTurnos, insertar };
