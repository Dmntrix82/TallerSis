const { query } = require("../config/db");

const num = (v) => (v === null || v === undefined ? v : Number(v));

function normalizar(r) {
  if (!r) return null;
  return { ...r, id: num(r.id), turno_id: num(r.turno_id), monto: num(r.monto) };
}

/**
 * TDSI-62/201/955: la operacion se guarda ya autorizada -- el supervisor puso su
 * usuario + PIN en el momento (validado antes de llegar aqui); no existe un
 * estado "pendiente" a la espera de que alguien la revise despues.
 */
async function crear({ turno_id, caja_id, tipo, descripcion, monto, solicitado_por, solicitado_por_nombre, autorizado_por, autorizado_por_nombre }) {
  const { rows } = await query(
    `INSERT INTO caja.aprobaciones_especiales
       (turno_id, caja_id, tipo, descripcion, monto, solicitado_por, solicitado_por_nombre,
        estado, autorizado_por, autorizado_por_nombre, resuelto_en)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'APROBADA', $8, $9, now())
     RETURNING *`,
    [turno_id, caja_id, tipo, descripcion, monto, solicitado_por, solicitado_por_nombre || null, autorizado_por, autorizado_por_nombre]
  );
  return normalizar(rows[0]);
}

async function obtenerPorId(id) {
  const { rows } = await query(`SELECT * FROM caja.aprobaciones_especiales WHERE id = $1`, [id]);
  return normalizar(rows[0]);
}

/** TDSI-62/957: lista para el historial, con filtro opcional por tipo, caja y supervisor. */
async function listar({ tipo = null, caja_id = null, autorizado_por = null } = {}) {
  const { rows } = await query(
    `SELECT * FROM caja.aprobaciones_especiales
      WHERE ($1::text IS NULL OR tipo = $1)
        AND ($2::text IS NULL OR caja_id = $2)
        AND ($3::text IS NULL OR autorizado_por = $3)
      ORDER BY creado_en DESC`,
    [tipo, caja_id, autorizado_por]
  );
  return rows.map(normalizar);
}

module.exports = { crear, obtenerPorId, listar };
