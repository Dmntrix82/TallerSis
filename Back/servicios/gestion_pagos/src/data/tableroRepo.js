const { query } = require("../config/db");

const num = (v) => (v === null || v === undefined ? v : Number(v));

// TDSI-377: el dia pedido como rango [inicio, fin) en vez de castear la columna
// (fecha::date), asi la consulta puede usar el indice sobre fecha/recibida_en en
// vez de recorrer toda la tabla.
// TDSI-381: "fecha" es un string 'YYYY-MM-DD'; por defecto (llamadas sin fecha)
// sigue siendo el dia de hoy, igual que antes.

/** TDSI-375: ingresos fisicos (pagos en el mostrador) del dia pedido */
async function totalIngresosFisicosEnFecha(fecha) {
  const { rows } = await query(
    `SELECT COALESCE(SUM(monto), 0) AS total, COUNT(DISTINCT id_transaccion)::int AS cantidad
     FROM pagos.transacciones
     WHERE estado = 'Registrado'
       AND fecha >= $1::date AND fecha < $1::date + INTERVAL '1 day'`,
    [fecha]
  );
  return { total: num(rows[0].total), cantidad: rows[0].cantidad };
}

/** TDSI-375: ingresos virtuales (ventas online) del dia pedido */
async function totalIngresosVirtualesEnFecha(fecha) {
  const { rows } = await query(
    `SELECT COALESCE(SUM(total), 0) AS total, COUNT(*)::int AS cantidad
     FROM pagos.ventas_online
     WHERE estado = 'Pagado'
       AND recibida_en >= $1::date AND recibida_en < $1::date + INTERVAL '1 day'`,
    [fecha]
  );
  return { total: num(rows[0].total), cantidad: rows[0].cantidad };
}

/**
 * TDSI-376: totales del dia pedido agrupados por caja. Cubre pagos simples (caja_id
 * propio) y pagos mixtos (caja_id vive en pagos_mixtos, se une por pago_mixto_id).
 */
async function totalesPorCajaEnFecha(fecha) {
  const { rows } = await query(
    `SELECT COALESCE(t.caja_id, pm.caja_id, 'SIN_CAJA') AS caja_id,
            COALESCE(SUM(t.monto), 0) AS total,
            COUNT(DISTINCT t.id_transaccion)::int AS cantidad
     FROM pagos.transacciones t
     LEFT JOIN pagos.pagos_mixtos pm ON pm.id = t.pago_mixto_id
     WHERE t.estado = 'Registrado'
       AND t.fecha >= $1::date AND t.fecha < $1::date + INTERVAL '1 day'
     GROUP BY COALESCE(t.caja_id, pm.caja_id, 'SIN_CAJA')
     ORDER BY caja_id`,
    [fecha]
  );
  return rows.map((r) => ({ ...r, total: num(r.total) }));
}

module.exports = { totalIngresosFisicosEnFecha, totalIngresosVirtualesEnFecha, totalesPorCajaEnFecha };
