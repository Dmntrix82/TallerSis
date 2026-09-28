const { query } = require("../config/db");

async function buscarPorCodigo(codigo) {
  const resultado = await query(
    "SELECT id, codigo, nombre, estado FROM caja.cajas WHERE codigo = $1",
    [codigo]
  );
  return resultado.rows[0] || null;
}

module.exports = { buscarPorCodigo };
