const { query } = require("../config/db");

/** TDSI-47/171: perfil de un cajero, ligado a su cuenta de Supabase Auth (cajero_id). */
async function crear({ cajero_id, usuario, nombre }) {
  const { rows } = await query(
    `INSERT INTO caja.cajeros (cajero_id, usuario, nombre) VALUES ($1, $2, $3) RETURNING *`,
    [cajero_id, usuario, nombre]
  );
  return rows[0];
}

async function buscarPorUsuario(usuario) {
  const { rows } = await query(`SELECT * FROM caja.cajeros WHERE usuario = $1`, [usuario]);
  return rows[0] || null;
}

module.exports = { crear, buscarPorUsuario };
