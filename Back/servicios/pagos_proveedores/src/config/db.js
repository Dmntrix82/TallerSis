require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.on("error", (err) => console.error("Error inesperado en PostgreSQL:", err));

const query = (text, params) => pool.query(text, params);

module.exports = { pool, query };
