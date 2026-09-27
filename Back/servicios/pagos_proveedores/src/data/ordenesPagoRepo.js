const { pool } = require("../config/db");

async function existeOrden(ordenCompraId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM proveedores.ordenes_pago WHERE orden_compra_id = $1`,
    [ordenCompraId]
  );
  return rows.length > 0;
}

async function guardarOrdenPendiente(orden) {
  const { rows } = await pool.query(
    `INSERT INTO proveedores.ordenes_pago 
     (numero, orden_compra_id, proveedor_nit, proveedor_razon_social, proveedor_cuenta_bancaria, proveedor_banco, monto, estado)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDIENTE')
     RETURNING *`,
    [
      orden.numero,
      orden.ordenCompraId,
      orden.proveedor.nit,
      orden.proveedor.razonSocial,
      orden.proveedor.cuentaBancaria,
      orden.proveedor.banco,
      orden.monto
    ]
  );
  return rows[0];
}

// TDSI-394: Registrar la notificación en tu base de datos
async function guardarNotificacionAdmin(ordenPagoId, mensaje) {
  const { rows } = await pool.query(
    `INSERT INTO proveedores.notificaciones_admin (orden_pago_id, mensaje)
     VALUES ($1, $2) RETURNING *`,
    [ordenPagoId, mensaje]
  );
  return rows[0];
}

module.exports = { existeOrden, guardarOrdenPendiente, guardarNotificacionAdmin };