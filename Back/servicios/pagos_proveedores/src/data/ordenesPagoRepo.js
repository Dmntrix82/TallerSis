const { pool, query } = require("../config/db");

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
      orden.monto,
    ]
  );
  return rows[0];
}

// TDSI-394: Registrar la notificacion en la base de datos
async function guardarNotificacionAdmin(ordenPagoId, mensaje) {
  const { rows } = await pool.query(
    `INSERT INTO proveedores.notificaciones_admin (orden_pago_id, mensaje)
     VALUES ($1, $2) RETURNING *`,
    [ordenPagoId, mensaje]
  );
  return rows[0];
}

/** TDSI-404: consultar la orden por su numero */
async function buscarPorNumero(numero) {
  const resultado = await query(
    "SELECT id, numero, proveedor_razon_social, monto, estado FROM proveedores.ordenes_pago WHERE numero = $1",
    [numero]
  );
  return resultado.rows[0] || null;
}

async function buscarPorId(id) {
  const resultado = await query(
    "SELECT id, numero, proveedor_razon_social, monto, estado FROM proveedores.ordenes_pago WHERE id = $1",
    [id]
  );
  return resultado.rows[0] || null;
}

async function marcarLiquidada(id, liquidada_por) {
  const resultado = await query(
    `UPDATE proveedores.ordenes_pago
     SET estado = 'LIQUIDADA', liquidada_en = now(), liquidada_por = $2
     WHERE id = $1
     RETURNING id, numero, estado, liquidada_en, liquidada_por`,
    [id, liquidada_por || null]
  );
  return resultado.rows[0];
}

module.exports = {
  existeOrden,
  guardarOrdenPendiente,
  guardarNotificacionAdmin,
  buscarPorId,
  buscarPorNumero,
  marcarLiquidada,
};