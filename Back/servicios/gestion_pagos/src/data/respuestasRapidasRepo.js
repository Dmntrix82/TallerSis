const { query } = require("../config/db");

const num = (v) => (v === null || v === undefined ? v : Number(v));

function normalizar(r) {
  if (!r) return null;
  return { ...r, id: num(r.id), orden: num(r.orden) };
}

/** TDSI-799: Lista las respuestas rápidas de un cajero, ordenadas. */
async function listarPorCajero(cajero_id) {
  const { rows } = await query(
    `SELECT id, cajero_id, texto, orden, creado_en
       FROM pagos.respuestas_rapidas
      WHERE cajero_id = $1
      ORDER BY orden ASC, id ASC`,
    [cajero_id]
  );
  return rows.map(normalizar);
}

/** TDSI-800: cuántas respuestas rápidas tiene ya el cajero (para el máximo de 8). */
async function contarPorCajero(cajero_id) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS total FROM pagos.respuestas_rapidas WHERE cajero_id = $1`,
    [cajero_id]
  );
  return rows[0].total;
}

/** TDSI-800: Crea una nueva respuesta rápida. */
async function crear({ cajero_id, texto, orden = 1 }) {
  const { rows } = await query(
    `INSERT INTO pagos.respuestas_rapidas (cajero_id, texto, orden)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [cajero_id, texto, orden]
  );
  return normalizar(rows[0]);
}

/** TDSI-800: Edita el texto de una respuesta rápida. */
async function actualizar(id, cajero_id, { texto }) {
  const { rows } = await query(
    `UPDATE pagos.respuestas_rapidas
        SET texto = $1
      WHERE id = $2 AND cajero_id = $3
      RETURNING *`,
    [texto, id, cajero_id]
  );
  return normalizar(rows[0]);
}

/** TDSI-801: Elimina una respuesta rápida (solo el dueño). */
async function eliminar(id, cajero_id) {
  const { rows } = await query(
    `DELETE FROM pagos.respuestas_rapidas
      WHERE id = $1 AND cajero_id = $2
      RETURNING id`,
    [id, cajero_id]
  );
  return rows.length > 0;
}

/** Obtiene una por ID (para validaciones). */
async function obtenerPorId(id) {
  const { rows } = await query(
    `SELECT * FROM pagos.respuestas_rapidas WHERE id = $1`,
    [id]
  );
  return normalizar(rows[0]);
}

module.exports = { listarPorCajero, contarPorCajero, crear, actualizar, eliminar, obtenerPorId };