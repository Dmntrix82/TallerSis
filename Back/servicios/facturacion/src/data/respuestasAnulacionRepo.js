const { query } = require("../config/db");
const num = (v) => (v === null || v === undefined ? v : Number(v));

function normalizar(r) {
  if (!r) return null;
  return { ...r, id: num(r.id), orden: num(r.orden) };
}

/** TDSI-890: Lista las respuestas de anulación de un cajero. */
async function listarPorCajero(cajero_id) {
  const { rows } = await query(
    `SELECT * FROM facturacion.respuestas_anulacion
      WHERE cajero_id = $1
      ORDER BY orden ASC, id ASC`,
    [cajero_id]
  );
  return rows.map(normalizar);
}

/** TDSI-891: Crea una nueva respuesta. */
async function crear({ cajero_id, texto, orden = 1 }) {
  const { rows } = await query(
    `INSERT INTO facturacion.respuestas_anulacion (cajero_id, texto, orden)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [cajero_id, texto, orden]
  );
  return normalizar(rows[0]);
}

/** TDSI-891: Edita el texto. */
async function actualizar(id, cajero_id, { texto }) {
  const { rows } = await query(
    `UPDATE facturacion.respuestas_anulacion
        SET texto = $1
      WHERE id = $2 AND cajero_id = $3
      RETURNING *`,
    [texto, id, cajero_id]
  );
  return normalizar(rows[0]);
}

/** TDSI-892: Elimina una respuesta. */
async function eliminar(id, cajero_id) {
  const { rows } = await query(
    `DELETE FROM facturacion.respuestas_anulacion
      WHERE id = $1 AND cajero_id = $2
      RETURNING id`,
    [id, cajero_id]
  );
  return rows.length > 0;
}

/** Obtiene una por ID (para validaciones). */
async function obtenerPorId(id) {
  const { rows } = await query(
    `SELECT * FROM facturacion.respuestas_anulacion WHERE id = $1`,
    [id]
  );
  return normalizar(rows[0]);
}

module.exports = { listarPorCajero, crear, actualizar, eliminar, obtenerPorId };