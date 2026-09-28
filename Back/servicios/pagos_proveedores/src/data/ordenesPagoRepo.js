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

// TDSI-394: Registrar la notificacion en la base de datos
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

// TDSI-394: notificaciones del administrador (por defecto solo las no leidas), la mas reciente primero
async function listarNotificaciones({ incluirLeidas = false } = {}) {
  const { rows } = await pool.query(
    `SELECT n.id, o.numero AS "ordenId", n.mensaje, n.leida, n.creado_en AS "creadaEn"
     FROM proveedores.notificaciones_admin n
     JOIN proveedores.ordenes_pago o ON o.id = n.orden_pago_id
     WHERE ($1::boolean OR n.leida = false)
     ORDER BY n.creado_en DESC, n.id DESC`,
    [incluirLeidas]
  );
  return rows;
}

// TDSI-394: marca una notificacion como leida (devuelve null si no existe)
async function marcarNotificacionLeida(id) {
  const { rows } = await pool.query(
    `UPDATE proveedores.notificaciones_admin SET leida = true WHERE id = $1
     RETURNING id, mensaje, leida, creado_en AS "creadaEn"`,
    [id]
  );
  return rows[0] || null;
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
  listarPendientes,
  listarNotificaciones,
  marcarNotificacionLeida,
  buscarPorId,
  buscarPorNumero,
  marcarLiquidada,
};
