const { query } = require("../config/db");

const num = (v) => (v === null || v === undefined ? v : Number(v));

/**
 * Ventas de un cajero en un rango de dias (hora de Bolivia), una fila por venta.
 * Un pago Mixto tiene una fila por metodo en pagos.transacciones: aqui se junta en una
 * sola venta, con el detalle de cuanto se pago con cada metodo.
 * Parametros: $1 cajero_id, $2 desde (YYYY-MM-DD), $3 hasta (YYYY-MM-DD, inclusive),
 *             $4 metodo (opcional: ventas que usaron ese metodo).
 */
const CTE_VENTAS = `
  ventas AS (
    SELECT id_transaccion,
           MIN(fecha)                                                       AS fecha,
           MAX(cajero)                                                      AS cajero,
           MAX(caja_id)                                                     AS caja_id,
           MAX(tipo_pago)                                                   AS tipo_pago,
           SUM(monto)                                                       AS total,
           array_agg(metodo ORDER BY id)                                    AS metodos,
           json_agg(json_build_object('metodo', metodo, 'monto', monto) ORDER BY id) AS detalle_metodos,
           MAX(tipo_documento)                                              AS tipo_documento,
           MAX(nit)                                                         AS nit,
           MAX(razon_social)                                                AS razon_social,
           CASE WHEN bool_and(estado = 'Anulado')       THEN 'ANULADA'
                WHEN bool_or(estado_pago = 'RECHAZADA') THEN 'RECHAZADA'
                WHEN bool_or(estado_pago = 'PENDIENTE') THEN 'PENDIENTE'
                ELSE 'APROBADA' END                                         AS estado
      FROM pagos.transacciones
     WHERE cajero_id = $1
       AND fecha >= ($2::date)::timestamp AT TIME ZONE 'America/La_Paz'
       AND fecha <  ($3::date + 1)::timestamp AT TIME ZONE 'America/La_Paz'
     GROUP BY id_transaccion
    HAVING ($4::text IS NULL OR bool_or(metodo = $4))
  )`;

/**
 * TDSI-427: transacciones (ventas) de un cajero, de la mas reciente a la mas antigua, paginadas.
 * Devuelve { total, filas } donde total = cantidad de ventas que cumplen los filtros.
 */
async function listarTransaccionesCajero({ cajeroId, desde, hasta, metodo = null, limite, offset }) {
  const params = [cajeroId, desde, hasta, metodo];

  const { rows: conteo } = await query(`WITH ${CTE_VENTAS} SELECT COUNT(*)::int AS total FROM ventas`, params);

  const { rows } = await query(
    `WITH ${CTE_VENTAS}
     SELECT v.*,
            to_char(v.fecha AT TIME ZONE 'America/La_Paz', 'YYYY-MM-DD') AS fecha_local,
            to_char(v.fecha AT TIME ZONE 'America/La_Paz', 'HH24:MI:SS') AS hora
       FROM ventas v
      ORDER BY v.fecha DESC, v.id_transaccion DESC
      LIMIT $5 OFFSET $6`,
    [...params, limite, offset]
  );

  return {
    total: conteo[0].total,
    filas: rows.map((r) => ({
      ...r,
      total: num(r.total),
      detalle_metodos: r.detalle_metodos.map((d) => ({ metodo: d.metodo, monto: num(d.monto) })),
    })),
  };
}

/**
 * TDSI-428: resumen de un cajero en el rango de dias.
 *   - por estado: cuantas ventas aprobadas / anuladas / rechazadas / pendientes y sus montos
 *   - por metodo: cuantas ventas APROBADAS usaron cada metodo y cuanto se cobro con cada uno
 *     (una venta mixta Efectivo+QR cuenta en los dos metodos, con el monto de cada parte)
 */
async function resumenCajero({ cajeroId, desde, hasta }) {
  const params = [cajeroId, desde, hasta, null];

  const { rows: totales } = await query(
    `WITH ${CTE_VENTAS}
     SELECT MAX(cajero)                                                    AS cajero,
            COUNT(*)::int                                                  AS cantidad_transacciones,
            COUNT(*) FILTER (WHERE estado = 'APROBADA')::int               AS cantidad_aprobadas,
            COUNT(*) FILTER (WHERE estado = 'ANULADA')::int                AS cantidad_anuladas,
            COUNT(*) FILTER (WHERE estado = 'RECHAZADA')::int              AS cantidad_rechazadas,
            COUNT(*) FILTER (WHERE estado = 'PENDIENTE')::int              AS cantidad_pendientes,
            COALESCE(SUM(total) FILTER (WHERE estado = 'APROBADA'), 0)     AS total,
            COALESCE(SUM(total) FILTER (WHERE estado = 'ANULADA'), 0)      AS total_anulado,
            MIN(fecha)                                                     AS primera_operacion,
            MAX(fecha)                                                     AS ultima_operacion
       FROM ventas`,
    params
  );

  const { rows: porMetodo } = await query(
    `WITH ${CTE_VENTAS}
     SELECT t.metodo,
            COUNT(DISTINCT t.id_transaccion)::int AS cantidad,
            SUM(t.monto)                          AS total
       FROM pagos.transacciones t
       JOIN ventas v ON v.id_transaccion = t.id_transaccion
      WHERE t.cajero_id = $1 AND v.estado = 'APROBADA'
      GROUP BY t.metodo`,
    params
  );

  const t = totales[0];
  return {
    cajero: t.cajero,
    cantidad_transacciones: t.cantidad_transacciones,
    cantidad_aprobadas: t.cantidad_aprobadas,
    cantidad_anuladas: t.cantidad_anuladas,
    cantidad_rechazadas: t.cantidad_rechazadas,
    cantidad_pendientes: t.cantidad_pendientes,
    total: num(t.total),
    total_anulado: num(t.total_anulado),
    primera_operacion: t.primera_operacion,
    ultima_operacion: t.ultima_operacion,
    por_metodo: porMetodo.map((m) => ({ metodo: m.metodo, cantidad: m.cantidad, total: num(m.total) })),
  };
}

module.exports = { CTE_VENTAS, listarTransaccionesCajero, resumenCajero };