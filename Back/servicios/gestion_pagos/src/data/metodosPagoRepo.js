const { query } = require("../config/db");

const num = (v) => (v === null || v === undefined ? v : Number(v));

/**
 * TDSI-34: monitoreo de metodos de pago para el Supervisor de Caja.
 * Solo cuentan las ventas cobradas: todas sus filas en estado 'Registrado' y estado_pago 'APROBADA'
 * (una venta anulada, rechazada o pendiente no suma en ningun metodo).
 * TDSI-436: un pago mixto tiene una fila por metodo en pagos.transacciones, unida a su cabecera
 * pagos.pagos_mixtos por pago_mixto_id: cada parte suma en su metodo (Efectivo 30 + QR 70 suma
 * 30 en Efectivo y 70 en QR). Si la cabecera esta anulada, no suma ninguna parte.
 * Dias en hora de Bolivia. Parametros: $1 desde (YYYY-MM-DD), $2 hasta (YYYY-MM-DD, inclusive).
 */
const CTE_FILAS = `
  filas AS (
    SELECT t.id_transaccion, t.metodo, t.monto,
           (t.pago_mixto_id IS NOT NULL OR t.tipo_pago = 'Mixto') AS es_mixto,
           (t.estado = 'Registrado' AND t.estado_pago = 'APROBADA'
              AND COALESCE(pm.estado, 'Registrado') = 'Registrado') AS cobrada
      FROM pagos.transacciones t
      LEFT JOIN pagos.pagos_mixtos pm ON pm.id = t.pago_mixto_id
     WHERE t.fecha >= ($1::date)::timestamp AT TIME ZONE 'America/La_Paz'
       AND t.fecha <  ($2::date + 1)::timestamp AT TIME ZONE 'America/La_Paz'
  ),
  cobradas AS (
    SELECT id_transaccion FROM filas GROUP BY id_transaccion HAVING bool_and(cobrada)
  ),
  ventas AS (
    SELECT f.* FROM filas f JOIN cobradas c ON c.id_transaccion = f.id_transaccion
  )`;

/**
 * TDSI-435: ventas agrupadas por metodo: cantidad de ventas que usaron el metodo, monto cobrado
 * con ese metodo y porcentaje del monto total (redondeado a 2 decimales en la BD).
 * TDSI-436: desglosado en lo que viene de pagos simples y lo que viene de pagos mixtos.
 */
async function agruparPorMetodo(filtros) {
  const { rows } = await query(
    `WITH ${CTE_FILAS}
     SELECT metodo,
            COUNT(DISTINCT id_transaccion)::int                                         AS cantidad,
            SUM(monto)                                                                  AS monto,
            ROUND(100 * SUM(monto) / NULLIF(SUM(SUM(monto)) OVER (), 0), 2)             AS porcentaje,
            COUNT(DISTINCT id_transaccion) FILTER (WHERE NOT es_mixto)::int             AS cantidad_simples,
            COALESCE(SUM(monto) FILTER (WHERE NOT es_mixto), 0)                         AS monto_simples,
            COUNT(DISTINCT id_transaccion) FILTER (WHERE es_mixto)::int                 AS cantidad_mixtos,
            COALESCE(SUM(monto) FILTER (WHERE es_mixto), 0)                             AS monto_mixtos
       FROM ventas
      GROUP BY metodo`,
    parametros(filtros)
  );
  return rows.map((r) => ({
    metodo: r.metodo,
    cantidad: r.cantidad,
    monto: num(r.monto),
    porcentaje: num(r.porcentaje),
    simples: { cantidad: r.cantidad_simples, monto: num(r.monto_simples) },
    mixtos: { cantidad: r.cantidad_mixtos, monto: num(r.monto_mixtos) },
  }));
}

/**
 * TDSI-436: totales de las ventas cobradas (cada venta cuenta una vez, aunque sea mixta)
 * y las combinaciones de metodos de los pagos mixtos (ej. Efectivo + QR: 3 ventas, 250 Bs).
 */
async function totalesYMixtos(filtros) {
  const params = parametros(filtros);
  const { rows: totales } = await query(
    `WITH ${CTE_FILAS}
     SELECT COUNT(DISTINCT id_transaccion)::int                         AS cantidad_operaciones,
            COALESCE(SUM(monto), 0)                                     AS monto_total,
            COUNT(DISTINCT id_transaccion) FILTER (WHERE es_mixto)::int AS cantidad_mixtos,
            COALESCE(SUM(monto) FILTER (WHERE es_mixto), 0)             AS monto_mixtos
       FROM ventas`,
    params
  );
  const { rows: combinaciones } = await query(
    `WITH ${CTE_FILAS},
     mixtos AS (
       SELECT id_transaccion,
              array_agg(metodo ORDER BY array_position(ARRAY['Efectivo','Tarjeta','QR']::text[], metodo::text)) AS metodos,
              SUM(monto) AS monto
         FROM ventas
        WHERE es_mixto
        GROUP BY id_transaccion
     )
     SELECT metodos, COUNT(*)::int AS cantidad, SUM(monto) AS monto
       FROM mixtos
      GROUP BY metodos
      ORDER BY COUNT(*) DESC, SUM(monto) DESC`,
    params
  );
  const t = totales[0];
  return {
    cantidad_operaciones: t.cantidad_operaciones,
    monto_total: num(t.monto_total),
    pagos_mixtos: {
      cantidad: t.cantidad_mixtos,
      monto: num(t.monto_mixtos),
      combinaciones: combinaciones.map((c) => ({ metodos: c.metodos, cantidad: c.cantidad, monto: num(c.monto) })),
    },
  };
}

function parametros({ desde, hasta }) {
  return [desde, hasta];
}

module.exports = { agruparPorMetodo, totalesYMixtos };