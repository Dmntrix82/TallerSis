const { query } = require("../config/db");

async function buscarPorCodigo(codigo) {
  const resultado = await query(
    "SELECT id, codigo, nombre, estado FROM caja.cajas WHERE codigo = $1",
    [codigo]
  );
  return resultado.rows[0] || null;
}

/** Lista de cajas activas, para el selector de "Caja / terminal" del login. */
async function listarActivas() {
  const resultado = await query(
    "SELECT codigo, nombre FROM caja.cajas WHERE estado = 'ACTIVA' ORDER BY codigo"
  );
  return resultado.rows;
}

module.exports = { buscarPorCodigo, listarActivas };
