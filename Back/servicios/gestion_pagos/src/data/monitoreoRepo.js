const { query } = require("../config/db");

const num = (v) => (v === null || v === undefined ? v : Number(v));

/**
 * TDSI-424: ultimas operaciones de cada cajero en un dia (hora de Bolivia).
 * Una "operacion" es una venta: un pago Mixto tiene varias filas (una por metodo)
 * y aqui se junta en una sola, sumando sus montos.
 * Estado de la operacion:
 *   ANULADA    -> la venta fue anulada (estado = 'Anulado')
 *   RECHAZADA  -> el cobro fue rechazado (estado_pago = 'RECHAZADA')
 *   PENDIENTE  -> el cobro aun no se confirma (estado_pago = 'PENDIENTE')
 *   APROBADA   -> venta registrada y cobrada
 * Filtros opcionales por caja y por cajero; "limite" = cuantas operaciones por cajero.
 */
async function ultimasOperacionesPorCajero({ fecha, cajaId = null, cajeroId = null, limite = 5 }) {
  const { rows } = await query(
    `WITH operaciones AS (
       SELECT cajero_id,
              MAX(cajero)                              AS cajero,
              id_transaccion,
              MIN(fecha)                               AS fecha,
              MAX(caja_id)                             AS caja_id,
              SUM(monto)                               AS monto,
              array_agg(metodo ORDER BY id)            AS metodos,
              MAX(tipo_pago)                           AS tipo_pago,
              bool_and(estado = 'Anulado')             AS anulada,
              bool_or(estado_pago = 'RECHAZADA')       AS rechazada,
              bool_or(estado_pago = 'PENDIENTE')       AS pendiente
         FROM pagos.transacciones
        WHERE cajero_id IS NOT NULL
          AND fecha >= ($1::date)::timestamp AT TIME ZONE 'America/La_Paz'
          AND fecha <  ($1::date + 1)::timestamp AT TIME ZONE 'America/La_Paz'
          AND ($2::text IS NULL OR caja_id = $2)
          AND ($3::text IS NULL OR cajero_id = $3)
        GROUP BY cajero_id, id_transaccion
     ),
     numeradas AS (
       SELECT *, ROW_NUMBER() OVER (PARTITION BY cajero_id ORDER BY fecha DESC, id_transaccion DESC) AS n
         FROM operaciones
     )
     SELECT cajero_id, cajero, id_transaccion, fecha, caja_id, monto, metodos, tipo_pago,
            to_char(fecha AT TIME ZONE 'America/La_Paz', 'HH24:MI:SS') AS hora,
            CASE WHEN anulada   THEN 'ANULADA'
                 WHEN rechazada THEN 'RECHAZADA'
                 WHEN pendiente THEN 'PENDIENTE'
                 ELSE 'APROBADA' END                   AS estado
       FROM numeradas
      WHERE n <= $4
      ORDER BY cajero_id, fecha DESC, id_transaccion DESC`,
    [fecha, cajaId, cajeroId, limite]
  );
  return rows.map((r) => ({ ...r, monto: num(r.monto) }));
}

module.exports = { ultimasOperacionesPorCajero };