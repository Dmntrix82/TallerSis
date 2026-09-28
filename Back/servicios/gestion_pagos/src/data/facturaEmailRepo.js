const { query } = require("../config/db");

async function registrarEnvio({ id_transaccion, email, estado, payload }) {
  const { rows } = await query(
    `INSERT INTO pagos.facturas_enviadas (id_transaccion, email, estado, payload)
     VALUES ($1, $2, $3, $4)
     RETURNING id, id_transaccion, email, estado, creado_en`,
    [id_transaccion, email, estado, payload]
  );
  return rows[0];
}

module.exports = { registrarEnvio };
