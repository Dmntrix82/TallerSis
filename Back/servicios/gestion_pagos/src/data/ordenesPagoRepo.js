const { query, pool } = require("../config/db");

const num = (v) => (v === null || v === undefined ? v : Number(v));

// Crear la tabla si no existe
async function initDB() {
  await query(`
    CREATE TABLE IF NOT EXISTS pagos.ordenes_pago (
      id VARCHAR(50) PRIMARY KEY,
      proveedor VARCHAR(255) NOT NULL,
      nit VARCHAR(50) NOT NULL,
      monto NUMERIC(10,2) NOT NULL,
      fecha_emision DATE NOT NULL,
      fecha_vencimiento DATE NOT NULL,
      concepto TEXT,
      estado VARCHAR(50) DEFAULT 'pendiente',
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

// Llamar a initDB para asegurar que la tabla existe
initDB().catch(console.error);

async function guardarOrden(orden) {
  const { rows } = await query(
    `INSERT INTO pagos.ordenes_pago (id, proveedor, nit, monto, fecha_emision, fecha_vencimiento, concepto, estado)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pendiente')
     RETURNING *`,
    [orden.id, orden.proveedor, orden.nit, orden.monto, orden.fechaEmision, orden.fechaVencimiento, orden.concepto || '']
  );
  return { ...rows[0], monto: num(rows[0].monto) };
}

async function obtenerOrdenesPendientes() {
  const { rows } = await query(
    `SELECT id, proveedor, nit, monto, 
            TO_CHAR(fecha_emision, 'YYYY-MM-DD') as "fechaEmision", 
            TO_CHAR(fecha_vencimiento, 'YYYY-MM-DD') as "fechaVencimiento", 
            concepto, estado 
     FROM pagos.ordenes_pago 
     WHERE estado = 'pendiente' 
     ORDER BY fecha_emision DESC`
  );
  return rows.map(r => ({ ...r, monto: num(r.monto) }));
}

module.exports = {
  guardarOrden,
  obtenerOrdenesPendientes
};
