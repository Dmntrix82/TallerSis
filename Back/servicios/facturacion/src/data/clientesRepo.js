const { query } = require("../config/db");

async function buscarPorNit(nit) {
  const { rows } = await query(
    `SELECT nit, razon_social, email FROM facturacion.clientes_frecuentes WHERE nit = $1`,
    [nit]
  );
  return rows[0] || null;
}

async function sugerir(q, limite) {
  const { rows } = await query(
    `SELECT nit, razon_social FROM facturacion.clientes_frecuentes
     WHERE nit ILIKE $1 OR lower(razon_social) ILIKE $1
     ORDER BY razon_social LIMIT $2`,
    [`%${q}%`, limite]
  );
  return rows;
}

async function upsert({ nit, razon_social, email }) {
  const { rows } = await query(
    `INSERT INTO facturacion.clientes_frecuentes (nit, razon_social, email)
     VALUES ($1, $2, $3)
     ON CONFLICT (nit) DO UPDATE
       SET razon_social = EXCLUDED.razon_social,
           email = COALESCE(EXCLUDED.email, facturacion.clientes_frecuentes.email),
           actualizado_en = now()
     RETURNING nit, razon_social, email`,
    [nit, razon_social, email || null]
  );
  return rows[0];
}

async function insertarSiNoExiste({ nit, razon_social, email }) {
  const existente = await buscarPorNit(nit);
  if (existente) return { creado: false, cliente: existente };
  return { creado: true, cliente: await upsert({ nit, razon_social, email }) };
}

module.exports = { buscarPorNit, sugerir, upsert, insertarSiNoExiste };