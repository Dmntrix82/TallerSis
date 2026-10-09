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

module.exports = { insertarEgreso, listarEgresos, egresosDelDiaPorMetodo };