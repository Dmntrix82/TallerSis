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
 * TDSI-429: cada venta trae su revision (REVISADA / OBSERVADA / PENDIENTE si no tiene) y se puede
 * filtrar por ese estado. Devuelve { total, filas } donde total = ventas que cumplen los filtros.
 */
async function listarTransaccionesCajero({ cajeroId, desde, hasta, metodo = null, estadoRevision = null, limite, offset }) {
  const params = [cajeroId, desde, hasta, metodo, estadoRevision];
  const desdeVentas = `
       FROM ventas v
       LEFT JOIN pagos.revisiones_transaccion r ON r.id_transaccion = v.id_transaccion
      WHERE ($5::text IS NULL OR COALESCE(r.estado, 'PENDIENTE') = $5)`;

  const { rows: conteo } = await query(`WITH ${CTE_VENTAS} SELECT COUNT(*)::int AS total ${desdeVentas}`, params);

  const { rows } = await query(
    `WITH ${CTE_VENTAS}
     SELECT v.*,
            to_char(v.fecha AT TIME ZONE 'America/La_Paz', 'YYYY-MM-DD') AS fecha_local,
            to_char(v.fecha AT TIME ZONE 'America/La_Paz', 'HH24:MI:SS') AS hora,
            COALESCE(r.estado, 'PENDIENTE') AS revision_estado,
            r.nota          AS revision_nota,
            r.revisado_por  AS revision_revisado_por,
            r.revisado_en   AS revision_revisado_en
     ${desdeVentas}
      ORDER BY v.fecha DESC, v.id_transaccion DESC
      LIMIT $6 OFFSET $7`,
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
     SELECT MAX(v.cajero)                                                    AS cajero,
            COUNT(*)::int                                                    AS cantidad_transacciones,
            COUNT(*) FILTER (WHERE v.estado = 'APROBADA')::int               AS cantidad_aprobadas,
            COUNT(*) FILTER (WHERE v.estado = 'ANULADA')::int                AS cantidad_anuladas,
            COUNT(*) FILTER (WHERE v.estado = 'RECHAZADA')::int              AS cantidad_rechazadas,
            COUNT(*) FILTER (WHERE v.estado = 'PENDIENTE')::int              AS cantidad_pendientes,
            COALESCE(SUM(v.total) FILTER (WHERE v.estado = 'APROBADA'), 0)   AS total,
            COALESCE(SUM(v.total) FILTER (WHERE v.estado = 'ANULADA'), 0)    AS total_anulado,
            MIN(v.fecha)                                                     AS primera_operacion,
            MAX(v.fecha)                                                     AS ultima_operacion,
            COUNT(r.id) FILTER (WHERE r.estado = 'REVISADA')::int            AS cantidad_revisadas,
            COUNT(r.id) FILTER (WHERE r.estado = 'OBSERVADA')::int           AS cantidad_observadas,
            COUNT(*) FILTER (WHERE r.id IS NULL)::int                        AS cantidad_sin_revisar
       FROM ventas v
       LEFT JOIN pagos.revisiones_transaccion r ON r.id_transaccion = v.id_transaccion`,
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
    revision: {
      revisadas: t.cantidad_revisadas,
      observadas: t.cantidad_observadas,
      sin_revisar: t.cantidad_sin_revisar,
    },
    por_metodo: porMetodo.map((m) => ({ metodo: m.metodo, cantidad: m.cantidad, total: num(m.total) })),
  };
}

/** TDSI-429: cajero y estado de una venta (null si el id_transaccion no existe). */
async function buscarVenta(idTransaccion) {
  const { rows } = await query(
    `SELECT id_transaccion, MAX(cajero_id) AS cajero_id, SUM(monto) AS total, MIN(fecha) AS fecha
       FROM pagos.transacciones
      WHERE id_transaccion = $1
      GROUP BY id_transaccion`,
    [idTransaccion]
  );
  return rows[0] ? { ...rows[0], total: num(rows[0].total) } : null;
}

/**
 * TDSI-429: marca la venta como REVISADA u OBSERVADA. Si ya tenia una revision, la reemplaza
 * (misma fila: queda el ultimo estado, nota, supervisor y hora).
 */
async function guardarRevision({ idTransaccion, estado, nota, revisadoPor }) {
  const { rows } = await query(
    `INSERT INTO pagos.revisiones_transaccion (id_transaccion, estado, nota, revisado_por, revisado_en)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (id_transaccion) DO UPDATE
       SET estado = EXCLUDED.estado,
           nota = EXCLUDED.nota,
           revisado_por = EXCLUDED.revisado_por,
           revisado_en = now()
     RETURNING id_transaccion, estado, nota, revisado_por, revisado_en, creado_en`,
    [idTransaccion, estado, nota, revisadoPor]
  );
  return rows[0];
}

module.exports = { CTE_VENTAS, listarTransaccionesCajero, resumenCajero, buscarVenta, guardarRevision };