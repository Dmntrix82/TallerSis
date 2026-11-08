const { query } = require("../config/db");

const num = (v) => (v === null || v === undefined ? v : Number(v));

/**
 * TDSI-54/185: agrupa por producto (sku) los items de las ventas online de un dia,
 * sumando cantidad y monto, sin contar las anuladas (estado != 'Pagado').
 *
 * OJO: pagos.transacciones (las ventas de mostrador/caja fisica) no tiene ningun
 * desglose por producto -- es un monto total por fila, no hay catalogo en todo el
 * sistema. Esta funcion SOLO puede agrupar lo que existe: los items de ventas_online.
 */
async function agruparPorProducto(desde, hasta) {
  const { rows } = await query(
    `SELECT i.sku,
            MAX(i.descripcion) AS descripcion,
            SUM(i.cantidad) AS cantidad,
            SUM(i.subtotal) AS monto
       FROM pagos.venta_online_items i
       JOIN pagos.ventas_online v ON v.id = i.venta_id
      WHERE v.estado = 'Pagado' AND v.recibida_en >= $1 AND v.recibida_en <= $2
      GROUP BY i.sku
      ORDER BY SUM(i.cantidad) DESC, i.sku`,
    [desde, hasta]
  );
  return rows.map((r) => ({ sku: r.sku, descripcion: r.descripcion, cantidad: num(r.cantidad), monto: num(r.monto) }));
}

module.exports = { agruparPorProducto };
