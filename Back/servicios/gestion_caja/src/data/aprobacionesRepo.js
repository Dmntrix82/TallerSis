const { query } = require("../config/db");

const num = (v) => (v === null || v === undefined ? v : Number(v));

/** Normaliza una fila de caja.aprobaciones_especiales (BIGINT/NUMERIC a number). */
function normalizar(r) {
  if (!r) return null;
  return { ...r, id: num(r.id), turno_id: num(r.turno_id), monto: num(r.monto) };
}

/** TDSI-475: registra la operacion especial en estado PENDIENTE. */
async function crear({ turno_id, caja_id, tipo, descripcion, monto, solicitado_por, solicitado_por_nombre }) {
  const { rows } = await query(
    `INSERT INTO caja.aprobaciones_especiales
       (turno_id, caja_id, tipo, descripcion, monto, solicitado_por, solicitado_por_nombre, estado)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDIENTE')
     RETURNING *`,
    [turno_id, caja_id, tipo, descripcion, monto, solicitado_por, solicitado_por_nombre || null]
  );
  return normalizar(rows[0]);
}

async function obtenerPorId(id) {
  const { rows } = await query(`SELECT * FROM caja.aprobaciones_especiales WHERE id = $1`, [id]);
  return normalizar(rows[0]);
}

/**
 * TDSI-476: aprueba o rechaza. Solo cambia si sigue PENDIENTE (WHERE estado = 'PENDIENTE'),
 * asi dos supervisores no pueden resolver la misma solicitud a la vez. Devuelve null si ya
 * estaba resuelta.
 */
async function resolver(id, { estado, autorizado_por, autorizado_por_nombre, motivo }) {
  const { rows } = await query(
    `UPDATE caja.aprobaciones_especiales
        SET estado = $2,
            autorizado_por = $3,
            autorizado_por_nombre = $4,
            motivo = $5,
            resuelto_en = now()
      WHERE id = $1 AND estado = 'PENDIENTE'
      RETURNING *`,
    [id, estado, autorizado_por, autorizado_por_nombre, motivo]
  );
  return normalizar(rows[0]);
}

/** TDSI-477: lista con filtros opcionales por estado, tipo y caja; primero las pendientes. */
async function listar({ estado = null, tipo = null, caja_id = null }) {
  const { rows } = await query(
    `SELECT * FROM caja.aprobaciones_especiales
      WHERE ($1::text IS NULL OR estado = $1)
        AND ($2::text IS NULL OR tipo = $2)
        AND ($3::text IS NULL OR caja_id = $3)
      ORDER BY (estado = 'PENDIENTE') DESC, creado_en DESC, id DESC`,
    [estado, tipo, caja_id]
  );
  return rows.map(normalizar);
}

module.exports = { crear, obtenerPorId, resolver, listar };
