const { query } = require("../config/db");

async function obtenerFacturaCompleta(numero) {
  const { rows: facturaRows } = await query(
    `SELECT * FROM facturacion.facturas WHERE numero = $1`,
    [numero]
  );
  const factura = facturaRows[0];
  if (!factura) return null;

  const { rows: items } = await query(
    `SELECT descripcion, cantidad, precio_unitario, subtotal
     FROM facturacion.factura_items WHERE factura_id = $1 ORDER BY id`,
    [factura.id]
  );

  const { rows: metodosPago } = await query(
    `SELECT metodo, monto FROM facturacion.factura_metodos_pago WHERE factura_id = $1 ORDER BY id`,
    [factura.id]
  );

  return { ...factura, items, metodosPago };
}

async function listarFacturas() {
  const { rows } = await query(
    `SELECT numero, cliente_nombre, cliente_nit, total, estado, impresa, fecha
     FROM facturacion.facturas ORDER BY fecha DESC`
  );
  return rows;
}

async function marcarImpresa(numero, impresaEn) {
  await query(
    `UPDATE facturacion.facturas
     SET impresa = true, veces_impresa = veces_impresa + 1, impresa_en = $2
     WHERE numero = $1`,
    [numero, impresaEn]
  );
}

async function incrementarVecesImpresa(numero) {
  const { rows } = await query(
    `UPDATE facturacion.facturas SET veces_impresa = veces_impresa + 1
     WHERE numero = $1 RETURNING veces_impresa`,
    [numero]
  );
  return rows[0]?.veces_impresa;
}

async function registrarImpresion({ facturaNumero, tipo, motivo, jobId }) {
  const { rows } = await query(
    `INSERT INTO facturacion.impresiones (factura_numero, tipo, motivo, job_id)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [facturaNumero, tipo, motivo || null, jobId]
  );
  return rows[0];
}

async function listarImpresiones(numero) {
  const { rows } = await query(
    `SELECT * FROM facturacion.impresiones WHERE factura_numero = $1 ORDER BY impreso_en`,
    [numero]
  );
  return rows;
}

module.exports = {
  obtenerFacturaCompleta,
  listarFacturas,
  marcarImpresa,
  incrementarVecesImpresa,
  registrarImpresion,
  listarImpresiones,
};