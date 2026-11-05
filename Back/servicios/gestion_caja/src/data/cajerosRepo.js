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

/** TDSI-47/916: lista de cajeros para la pantalla "Usuarios". */
async function listar() {
  const { rows } = await query(`SELECT * FROM caja.cajeros ORDER BY nombre`);
  return rows;
}

async function buscarPorCajeroId(cajero_id) {
  const { rows } = await query(`SELECT * FROM caja.cajeros WHERE cajero_id = $1`, [cajero_id]);
  return rows[0] || null;
}

/** TDSI-47/917: "Editar" -- cambia nombre y usuario (el usuario tambien es UNIQUE aqui). */
async function actualizar(cajero_id, { usuario, nombre }) {
  const { rows } = await query(
    `UPDATE caja.cajeros SET usuario = $2, nombre = $3 WHERE cajero_id = $1 RETURNING *`,
    [cajero_id, usuario, nombre]
  );
  return rows[0] || null;
}

/** TDSI-47/918: "Activar" / "Desactivar" -- un cajero desactivado no puede iniciar sesion. */
async function cambiarEstado(cajero_id, activo) {
  const { rows } = await query(
    `UPDATE caja.cajeros SET activo = $2 WHERE cajero_id = $1 RETURNING *`,
    [cajero_id, activo]
  );
  return rows[0] || null;
}

module.exports = { crear, buscarPorUsuario, listar, buscarPorCajeroId, actualizar, cambiarEstado };
