const { query } = require("../config/db");

/** Obtiene el tipo de cambio vigente (el último registrado). */
async function obtenerVigente() {
  const { rows } = await query(
    `SELECT id, valor, actualizado_en, actualizado_por
       FROM pagos.tipo_cambio
      ORDER BY id DESC
      LIMIT 1`
  );
  return rows[0] || null;
}

module.exports = { obtenerVigente };