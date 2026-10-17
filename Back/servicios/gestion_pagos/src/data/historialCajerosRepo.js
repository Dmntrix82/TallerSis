const { query } = require("../config/db");

const num = (v) => (v === null || v === undefined ? v : Number(v));

/**
 * TDSI-33: historial de operaciones de los cajeros en un rango de dias (hora de Bolivia).
 * Una fila por operacion (venta): un pago Mixto se junta en una sola, con el detalle por metodo.
 * Cada operacion trae su revision (PENDIENTE si el supervisor todavia no la reviso).
 * Parametros: $1 desde (YYYY-MM-DD), $2 hasta (YYYY-MM-DD, inclusive), $3 cajero_id (opcional).
 */
const CTE_HISTORIAL = `
  ventas AS (
    SELECT id_transaccion,
           MIN(fecha)                                                       AS fecha,
           MAX(cajero_id)                                                   AS cajero_id,
           MAX(cajero)                                                      AS cajero,
           MAX(caja_id)                                                     AS caja_id,
           MAX(tipo_pago)                                                   AS tipo_pago,
           SUM(monto)                                                       AS total,
           array_agg(metodo ORDER BY id)                                    AS metodos,
           json_agg(json_build_object('metodo', metodo, 'monto', monto) ORDER BY id) AS detalle_metodos,
           CASE WHEN bool_and(estado = 'Anulado')       THEN 'ANULADA'
                WHEN bool_or(estado_pago = 'RECHAZADA') THEN 'RECHAZADA'
                WHEN bool_or(estado_pago = 'PENDIENTE') THEN 'PENDIENTE'
                ELSE 'APROBADA' END                                         AS estado
      FROM pagos.transacciones
     WHERE cajero_id IS NOT NULL
       AND fecha >= ($1::date)::timestamp AT TIME ZONE 'America/La_Paz'
       AND fecha <  ($2::date + 1)::timestamp AT TIME ZONE 'America/La_Paz'
       AND ($3::text IS NULL OR cajero_id = $3)
     GROUP BY id_transaccion
  ),
  historial AS (
    SELECT v.*,
           to_char(v.fecha AT TIME ZONE 'America/La_Paz', 'YYYY-MM-DD') AS fecha_local,
           to_char(v.fecha AT TIME ZONE 'America/La_Paz', 'HH24:MI:SS') AS hora,
           COALESCE(r.estado, 'PENDIENTE') AS revision_estado,
           r.nota          AS revision_nota,
           r.revisado_por  AS revision_revisado_por,
           r.revisado_en   AS revision_revisado_en
      FROM ventas v
      LEFT JOIN pagos.revisiones_transaccion r ON r.id_transaccion = v.id_transaccion
  )`;

const parametros = ({ desde, hasta, cajeroId = null }) => [desde, hasta, cajeroId];

/**
 * TDSI-431: operaciones de los cajeros (o de uno solo), de la mas reciente a la mas antigua, paginadas.
 * Devuelve { total, filas } donde total = operaciones que cumplen los filtros (para la paginacion).
 */
async function listarHistorial({ limite, offset, ...filtros }) {
  const params = parametros(filtros);
  const { rows: conteo } = await query(`WITH ${CTE_HISTORIAL} SELECT COUNT(*)::int AS total FROM historial`, params);

  const { rows } = await query(
    `WITH ${CTE_HISTORIAL}
     SELECT * FROM historial
      ORDER BY fecha DESC, id_transaccion DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
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

module.exports = { CTE_HISTORIAL, listarHistorial };