const { query } = require("../config/db");

async function buscarPorClientId(clientId) {
  const { rows } = await query(
    `SELECT id, client_id, nombre, secret_hash, activo
       FROM pagos.sistemas_cliente
      WHERE client_id = $1`,
    [clientId]
  );
  return rows[0] || null;
}

async function estaActivo(clientId) {
  const { rows } = await query(
    `SELECT activo FROM pagos.sistemas_cliente WHERE client_id = $1`,
    [clientId]
  );
  return rows[0]?.activo === true;
}

async function registrarAcceso(id) {
  await query(
    `UPDATE pagos.sistemas_cliente SET ultimo_acceso = now() WHERE id = $1`,
    [id]
  );
}

async function crear({ client_id, nombre, secret_hash }) {
  const { rows } = await query(
    `INSERT INTO pagos.sistemas_cliente (client_id, nombre, secret_hash)
     VALUES ($1, $2, $3)
     RETURNING id, client_id, nombre, activo, creado_en`,
    [client_id, nombre, secret_hash]
  );
  return rows[0];
}

module.exports = { buscarPorClientId, estaActivo, registrarAcceso, crear };