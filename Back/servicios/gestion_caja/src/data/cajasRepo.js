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
/** TDSI-24/465: lista TODAS las cajas (activas e inactivas), para el panel del supervisor */
async function listarTodas() {
  const resultado = await query(
    "SELECT id, codigo, nombre, estado FROM caja.cajas ORDER BY codigo"
  );
  return resultado.rows;
}

/** TDSI-24/464: devuelve los caja_id que tienen turno ABIERTO ahora mismo */
async function obtenerCajasConTurnoAbierto() {
  const resultado = await query(
    "SELECT DISTINCT caja_id FROM caja.turnos WHERE estado = 'ABIERTO'"
  );
  return resultado.rows.map((r) => r.caja_id);
}

module.exports = {
  buscarPorCodigo,
  listarActivas,
  listarTodas,
  obtenerCajasConTurnoAbierto,
};
/** TDSI-24/465: lista TODAS las cajas (activas e inactivas) para el panel del supervisor */
async function listarTodas() {
  const resultado = await query(
    "SELECT id, codigo, nombre, estado FROM caja.cajas ORDER BY codigo"
  );
  return resultado.rows;
}

/** TDSI-24/464: devuelve los caja_id que tienen turno ABIERTO ahora mismo */
async function obtenerCajasConTurnoAbierto() {
  const resultado = await query(
    "SELECT DISTINCT caja_id FROM caja.turnos WHERE estado = 'ABIERTO'"
  );
  return resultado.rows.map((r) => r.caja_id);
}
module.exports = {
  buscarPorCodigo,
  listarActivas,
  listarTodas,
  obtenerCajasConTurnoAbierto,
};