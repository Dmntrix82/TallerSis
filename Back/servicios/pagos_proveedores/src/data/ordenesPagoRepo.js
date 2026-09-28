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
     (numero, orden_compra_id, proveedor_nit, proveedor_razon_social, proveedor_cuenta_bancaria, proveedor_banco, monto, fecha_vencimiento, concepto, estado)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDIENTE')
     RETURNING *`,
    [
      orden.numero,
      orden.ordenCompraId,
      orden.proveedor.nit,
      orden.proveedor.razonSocial,
      orden.proveedor.cuentaBancaria,
      orden.proveedor.banco,
      orden.monto,
      orden.fechaVencimiento ?? null,
      orden.concepto ?? null
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

// TDSI-116 / TDSI-395: ordenes pendientes para la bandeja del administrador.
// fechaEmision = dia en que llego la orden (creado_en), en hora de Bolivia.
async function listarPendientes() {
  const { rows } = await pool.query(
    `SELECT numero AS id,
            proveedor_razon_social AS proveedor,
            proveedor_nit AS nit,
            monto,
            TO_CHAR(creado_en AT TIME ZONE 'America/La_Paz', 'YYYY-MM-DD') AS "fechaEmision",
            TO_CHAR(fecha_vencimiento, 'YYYY-MM-DD') AS "fechaVencimiento",
            concepto,
            estado
     FROM proveedores.ordenes_pago
     WHERE estado = 'PENDIENTE'
     ORDER BY creado_en DESC, id DESC`
  );
  return rows.map((r) => ({ ...r, monto: Number(r.monto) }));
}

module.exports = { existeOrden, guardarOrdenPendiente, guardarNotificacionAdmin, listarPendientes };