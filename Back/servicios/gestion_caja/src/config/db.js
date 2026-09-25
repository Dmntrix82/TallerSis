const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
});

pool.on("error", (e) => console.error("Error inesperado en PostgreSQL:", e));

const query = (text, params) => pool.query(text, params);

// pool se exporta porque en TDSI-314 lo usaremos para transacciones
module.exports = { pool, query };