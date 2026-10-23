const { query } = require("../config/db");

async function insertarEgreso({ orden_pago_id, monto, metodo, descripcion, registrado_por }) {
  const resultado = await query(
    `INSERT INTO proveedores.egresos (orden_pago_id, monto, metodo, descripcion, registrado_por)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, orden_pago_id, monto, metodo, descripcion, registrado_por, registrado_en`,
    [orden_pago_id, monto, metodo, descripcion || null, registrado_por || null]
  );
  return resultado.rows[0];
}

async function listarEgresos() {
  const resultado = await query(
    `SELECT e.id, e.orden_pago_id, o.numero AS orden_numero, o.proveedor_razon_social,
            e.monto, e.metodo, e.descripcion, e.registrado_por, e.registrado_en
     FROM proveedores.egresos e
     JOIN proveedores.ordenes_pago o ON o.id = e.orden_pago_id
     ORDER BY e.registrado_en DESC`
  );
  return resultado.rows;
}

/**
 * TDSI-415: egresos (pagos a proveedores) de un dia, agrupados por metodo.
 * El dia se corta en hora de Bolivia, no en UTC, para que un pago de las 22:00
 * no caiga en el lote del dia siguiente.
 */
async function egresosDelDiaPorMetodo(fecha) {
  const resultado = await query(
    `SELECT metodo, COALESCE(SUM(monto), 0) AS total, COUNT(*)::int AS cantidad
     FROM proveedores.egresos
     WHERE registrado_en >= ($1::date)::timestamp AT TIME ZONE 'America/La_Paz'
       AND registrado_en <  ($1::date + 1)::timestamp AT TIME ZONE 'America/La_Paz'
     GROUP BY metodo
     ORDER BY metodo`,
    [fecha]
  );
  return resultado.rows.map((r) => ({ metodo: r.metodo, total: Number(r.total), cantidad: r.cantidad }));
}

/**
 * TDSI-22: cada egreso del dia (hora de Bolivia) con la orden de pago y el proveedor,
 * para el detalle del reporte a Contabilidad.
 */
async function egresosDelDia(fecha) {
  const resultado = await query(
    `SELECT e.id, o.numero AS orden_pago, o.orden_compra_id, o.proveedor_nit, o.proveedor_razon_social,
            COALESCE(e.descripcion, o.concepto) AS concepto, e.metodo, e.monto, e.registrado_por, e.registrado_en
     FROM proveedores.egresos e
     JOIN proveedores.ordenes_pago o ON o.id = e.orden_pago_id
     WHERE e.registrado_en >= ($1::date)::timestamp AT TIME ZONE 'America/La_Paz'
       AND e.registrado_en <  ($1::date + 1)::timestamp AT TIME ZONE 'America/La_Paz'
     ORDER BY e.registrado_en, e.id`,
    [fecha]
  );
  return resultado.rows.map((r) => ({
    egreso_id: Number(r.id),
    orden_pago: r.orden_pago,
    orden_compra_id: r.orden_compra_id,
    proveedor: { nit: r.proveedor_nit, razon_social: r.proveedor_razon_social },
    concepto: r.concepto,
    metodo: r.metodo,
    monto: Number(r.monto),
    registrado_por: r.registrado_por,
    registrado_en: r.registrado_en.toISOString(),
  }));
}

module.exports = { insertarEgreso, listarEgresos, egresosDelDiaPorMetodo, egresosDelDia };