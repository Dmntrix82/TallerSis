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

/** TDSI-489: lista las diferencias con filtros por estado, tipo y caja_id */
async function listar({ estado, tipo, caja_id }) {
  const cond = [];
  const params = [];

  if (estado) { params.push(estado); cond.push(`d.estado = $${params.length}`); }
  if (tipo) { params.push(tipo); cond.push(`d.tipo = $${params.length}`); }
  if (caja_id) { params.push(caja_id); cond.push(`t.caja_id = $${params.length}`); }

  const where = cond.length ? `WHERE ${cond.join(" AND ")}` : "";

  const { rows } = await query(
    `SELECT d.id, d.turno_id, t.caja_id, d.monto, d.tipo, d.estado,
            d.justificacion, d.resuelta_por, d.resuelta_en
       FROM caja.diferencias_resolucion d
       JOIN caja.turnos t ON t.id = d.turno_id
       ${where}
       ORDER BY d.id DESC`,
    params
  );
  return rows.map(normalizar);
}

/** TDSI-488: marca la diferencia como RESUELTA */
async function resolver(id, { justificacion, resuelta_por }) {
  const { rows } = await query(
    `UPDATE caja.diferencias_resolucion
        SET estado = 'RESUELTA',
            justificacion = $2,
            resuelta_por = $3,
            resuelta_en = now()
      WHERE id = $1 AND estado = 'PENDIENTE'
      RETURNING *`,
    [id, justificacion, resuelta_por]
  );
  return normalizar(rows[0]);
}

async function obtenerPorId(id) {
  const { rows } = await query(`SELECT * FROM caja.diferencias_resolucion WHERE id = $1`, [id]);
  return normalizar(rows[0]);
}

module.exports = { insertar, listar, resolver, obtenerPorId };
