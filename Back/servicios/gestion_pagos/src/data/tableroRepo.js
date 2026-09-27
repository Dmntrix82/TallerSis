const { query } = require("../config/db");

const num = (v) => (v === null || v === undefined ? v : Number(v));

// TDSI-377: "hoy" como rango [inicio, fin) en vez de castear la columna (fecha::date),
// asi la consulta puede usar el indice sobre fecha/recibida_en en vez de recorrer toda la tabla.

/** TDSI-375: ingresos fisicos (pagos en el mostrador) del dia */
async function totalIngresosFisicosHoy() {
  const { rows } = await query(
    `SELECT COALESCE(SUM(monto), 0) AS total, COUNT(DISTINCT id_transaccion)::int AS cantidad
     FROM pagos.transacciones
     WHERE estado = 'Registrado'
       AND fecha >= CURRENT_DATE AND fecha < CURRENT_DATE + INTERVAL '1 day'`
  );
  return { total: num(rows[0].total), cantidad: rows[0].cantidad };
}

/** TDSI-375: ingresos virtuales (ventas online) del dia */
async function totalIngresosVirtualesHoy() {
  const { rows } = await query(
    `SELECT COALESCE(SUM(total), 0) AS total, COUNT(*)::int AS cantidad
     FROM pagos.ventas_online
     WHERE estado = 'Pagado'
       AND recibida_en >= CURRENT_DATE AND recibida_en < CURRENT_DATE + INTERVAL '1 day'`
  );
  return { total: num(rows[0].total), cantidad: rows[0].cantidad };
}

/**
 * TDSI-376: totales de hoy agrupados por caja. Cubre pagos simples (caja_id propio)
 * y pagos mixtos (caja_id vive en pagos_mixtos, se une por pago_mixto_id).
 */
async function totalesPorCajaHoy() {
  const { rows } = await query(
    `SELECT COALESCE(t.caja_id, pm.caja_id, 'SIN_CAJA') AS caja_id,
            COALESCE(SUM(t.monto), 0) AS total,
            COUNT(DISTINCT t.id_transaccion)::int AS cantidad
     FROM pagos.transacciones t
     LEFT JOIN pagos.pagos_mixtos pm ON pm.id = t.pago_mixto_id
     WHERE t.estado = 'Registrado'
       AND t.fecha >= CURRENT_DATE AND t.fecha < CURRENT_DATE + INTERVAL '1 day'
     GROUP BY COALESCE(t.caja_id, pm.caja_id, 'SIN_CAJA')
     ORDER BY caja_id`
  );
  return rows.map((r) => ({ ...r, total: num(r.total) }));
}

module.exports = { totalIngresosFisicosHoy, totalIngresosVirtualesHoy, totalesPorCajaHoy };
