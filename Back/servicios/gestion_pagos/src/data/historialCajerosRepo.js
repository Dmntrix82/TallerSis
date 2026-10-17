const { query } = require("../config/db");

const num = (v) => (v === null || v === undefined ? v : Number(v));

/**
 * TDSI-33: historial de operaciones de los cajeros en un rango de dias (hora de Bolivia).
 * Una fila por operacion (venta): un pago Mixto se junta en una sola, con el detalle por metodo.
 * Cada operacion trae su revision (PENDIENTE si el supervisor todavia no la reviso).
 * Parametros: $1 desde (YYYY-MM-DD), $2 hasta (YYYY-MM-DD, inclusive), $3 cajero_id (opcional).
 * TDSI-433, filtros opcionales: $4 caja_id, $5 metodo (operaciones que usaron ese metodo; una mixta
 * Efectivo+QR aparece al filtrar por cualquiera de los dos, con su total completo),
 * $6 estado de revision (PENDIENTE = todavia sin revisar, REVISADA u OBSERVADA).
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
       AND ($4::text IS NULL OR caja_id = $4)
     GROUP BY id_transaccion
    HAVING ($5::text IS NULL OR bool_or(metodo = $5))
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
     WHERE ($6::text IS NULL OR COALESCE(r.estado, 'PENDIENTE') = $6)
  )`;

const parametros = ({ desde, hasta, cajeroId = null, cajaId = null, metodo = null, estadoRevision = null }) =>
  [desde, hasta, cajeroId, cajaId, metodo, estadoRevision];

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

/**
 * TDSI-432: resumen del historial (de todas las operaciones que cumplen los filtros, no solo la pagina):
 * por cajero y dia, por dia, por cajero y el total general, en una sola consulta (GROUPING SETS).
 * cantidad_operaciones cuenta todas; total suma solo las APROBADAS y total_anulado las ANULADAS.
 */
async function resumenHistorial(filtros) {
  const { rows } = await query(
    `WITH ${CTE_HISTORIAL}
     SELECT fecha_local,
            cajero_id,
            MAX(cajero)                                                   AS cajero,
            GROUPING(fecha_local, cajero_id)                              AS nivel,
            COUNT(*)::int                                                 AS cantidad_operaciones,
            COUNT(*) FILTER (WHERE estado = 'ANULADA')::int               AS cantidad_anuladas,
            COALESCE(SUM(total) FILTER (WHERE estado = 'APROBADA'), 0)    AS total,
            COALESCE(SUM(total) FILTER (WHERE estado = 'ANULADA'), 0)     AS total_anulado,
            COUNT(DISTINCT fecha_local)::int                              AS dias_con_operaciones,
            MIN(fecha)                                                    AS primera_operacion,
            MAX(fecha)                                                    AS ultima_operacion
       FROM historial
      GROUP BY GROUPING SETS ((fecha_local, cajero_id), (fecha_local), (cajero_id), ())
      ORDER BY fecha_local DESC NULLS LAST, cajero_id NULLS LAST`,
    parametros(filtros)
  );
  // nivel (bits de GROUPING): 0 = cajero y dia, 1 = dia, 2 = cajero, 3 = total general
  const filas = rows.map((r) => ({ ...r, total: num(r.total), total_anulado: num(r.total_anulado) }));
  return {
    general: filas.find((r) => r.nivel === 3),
    porDia: filas.filter((r) => r.nivel === 1),
    porCajero: filas.filter((r) => r.nivel === 2),
    porCajeroDia: filas.filter((r) => r.nivel === 0),
  };
}

module.exports = { CTE_HISTORIAL, listarHistorial, resumenHistorial };