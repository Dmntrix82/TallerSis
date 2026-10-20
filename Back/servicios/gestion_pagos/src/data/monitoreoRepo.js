const { query } = require("../config/db");

const num = (v) => (v === null || v === undefined ? v : Number(v));

/**
 * Operaciones del dia (hora de Bolivia), una fila por venta.
 * Una "operacion" es una venta: un pago Mixto tiene varias filas (una por metodo)
 * y aqui se junta en una sola, sumando sus montos.
 * Estado de la operacion:
 *   ANULADA    -> la venta fue anulada (estado = 'Anulado')
 *   RECHAZADA  -> el cobro fue rechazado (estado_pago = 'RECHAZADA')
 *   PENDIENTE  -> el cobro aun no se confirma (estado_pago = 'PENDIENTE')
 *   APROBADA   -> venta registrada y cobrada
 * Parametros: $1 fecha, $2 caja_id (opcional), $3 cajero_id (opcional).
 */
const CTE_OPERACIONES = `
  operaciones AS (
    SELECT cajero_id,
           MAX(cajero)                    AS cajero,
           id_transaccion,
           MIN(fecha)                     AS fecha,
           MAX(caja_id)                   AS caja_id,
           SUM(monto)                     AS monto,
           array_agg(metodo ORDER BY id)  AS metodos,
           MAX(tipo_pago)                 AS tipo_pago,
           CASE WHEN bool_and(estado = 'Anulado')       THEN 'ANULADA'
                WHEN bool_or(estado_pago = 'RECHAZADA') THEN 'RECHAZADA'
                WHEN bool_or(estado_pago = 'PENDIENTE') THEN 'PENDIENTE'
                ELSE 'APROBADA' END       AS estado
      FROM pagos.transacciones
     WHERE cajero_id IS NOT NULL
       AND fecha >= ($1::date)::timestamp AT TIME ZONE 'America/La_Paz'
       AND fecha <  ($1::date + 1)::timestamp AT TIME ZONE 'America/La_Paz'
       AND ($2::text IS NULL OR caja_id = $2)
       AND ($3::text IS NULL OR cajero_id = $3)
     GROUP BY cajero_id, id_transaccion
  )`;

const HORA = `to_char(fecha AT TIME ZONE 'America/La_Paz', 'HH24:MI:SS')`;

/**
 * TDSI-424: ultimas operaciones de cada cajero en un dia.
 * Filtros opcionales por caja y por cajero; "limite" = cuantas operaciones por cajero.
 */
async function ultimasOperacionesPorCajero({ fecha, cajaId = null, cajeroId = null, limite = 5 }) {
  const { rows } = await query(
    `WITH ${CTE_OPERACIONES},
     numeradas AS (
       SELECT *, ROW_NUMBER() OVER (PARTITION BY cajero_id ORDER BY fecha DESC, id_transaccion DESC) AS n
         FROM operaciones
     )
     SELECT cajero_id, cajero, id_transaccion, fecha, caja_id, monto, metodos, tipo_pago, estado,
            ${HORA} AS hora
       FROM numeradas
      WHERE n <= $4
      ORDER BY cajero_id, fecha DESC, id_transaccion DESC`,
    [fecha, cajaId, cajeroId, limite]
  );
  return rows.map((r) => ({ ...r, monto: num(r.monto) }));
}

/**
 * TDSI-425: resumen en vivo de cada cajero en un dia:
 *   cantidad de operaciones (y cuantas aprobadas / anuladas / rechazadas / pendientes),
 *   total vendido (solo operaciones APROBADAS: lo anulado o rechazado no es plata cobrada)
 *   y su ultima operacion.
 */
async function resumenPorCajero({ fecha, cajaId = null, cajeroId = null }) {
  const { rows } = await query(
    `WITH ${CTE_OPERACIONES},
     totales AS (
       SELECT cajero_id,
              MAX(cajero)                                              AS cajero,
              COUNT(*)::int                                            AS cantidad_operaciones,
              COUNT(*) FILTER (WHERE estado = 'APROBADA')::int         AS cantidad_aprobadas,
              COUNT(*) FILTER (WHERE estado = 'ANULADA')::int          AS cantidad_anuladas,
              COUNT(*) FILTER (WHERE estado = 'RECHAZADA')::int        AS cantidad_rechazadas,
              COUNT(*) FILTER (WHERE estado = 'PENDIENTE')::int        AS cantidad_pendientes,
              COALESCE(SUM(monto) FILTER (WHERE estado = 'APROBADA'), 0) AS total
         FROM operaciones
        GROUP BY cajero_id
     ),
     ultimas AS (
       SELECT DISTINCT ON (cajero_id)
              cajero_id, id_transaccion, fecha, caja_id, monto, metodos, tipo_pago, estado, ${HORA} AS hora
         FROM operaciones
        ORDER BY cajero_id, fecha DESC, id_transaccion DESC
     )
     SELECT t.*,
            u.id_transaccion AS ultima_id_transaccion, u.fecha AS ultima_fecha, u.hora AS ultima_hora,
            u.caja_id AS ultima_caja_id, u.monto AS ultima_monto, u.metodos AS ultima_metodos,
            u.tipo_pago AS ultima_tipo_pago, u.estado AS ultima_estado
       FROM totales t
       JOIN ultimas u USING (cajero_id)
      ORDER BY u.fecha DESC, t.cajero_id`,
    [fecha, cajaId, cajeroId]
  );

  return rows.map((r) => ({
    cajero_id: r.cajero_id,
    cajero: r.cajero,
    caja_id: r.ultima_caja_id,
    cantidad_operaciones: r.cantidad_operaciones,
    cantidad_aprobadas: r.cantidad_aprobadas,
    cantidad_anuladas: r.cantidad_anuladas,
    cantidad_rechazadas: r.cantidad_rechazadas,
    cantidad_pendientes: r.cantidad_pendientes,
    total: num(r.total),
    ultima_operacion: {
      id_transaccion: r.ultima_id_transaccion,
      fecha: r.ultima_fecha,
      hora: r.ultima_hora,
      metodos: r.ultima_metodos,
      monto: num(r.ultima_monto),
      tipo_pago: r.ultima_tipo_pago,
      estado: r.ultima_estado,
      caja_id: r.ultima_caja_id,
    },
  }));
}

module.exports = { ultimasOperacionesPorCajero, resumenPorCajero };