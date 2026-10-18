const { query } = require("../config/db");

const num = (v) => (v === null || v === undefined ? v : Number(v));

/**
 * TDSI-34: monitoreo de metodos de pago para el Supervisor de Caja.
 * Solo cuentan las ventas cobradas: todas sus filas en estado 'Registrado' y estado_pago 'APROBADA'
 * (una venta anulada, rechazada o pendiente no suma en ningun metodo).
 * Dias en hora de Bolivia. Parametros: $1 desde (YYYY-MM-DD), $2 hasta (YYYY-MM-DD, inclusive).
 */
const CTE_FILAS = `
  filas AS (
    SELECT t.id_transaccion, t.metodo, t.monto,
           (t.estado = 'Registrado' AND t.estado_pago = 'APROBADA') AS cobrada
      FROM pagos.transacciones t
     WHERE t.pago_mixto_id IS NULL AND t.tipo_pago = 'Simple'
       AND t.fecha >= ($1::date)::timestamp AT TIME ZONE 'America/La_Paz'
       AND t.fecha <  ($2::date + 1)::timestamp AT TIME ZONE 'America/La_Paz'
  ),
  cobradas AS (
    SELECT id_transaccion FROM filas GROUP BY id_transaccion HAVING bool_and(cobrada)
  )`;

/**
 * TDSI-435: pagos simples agrupados por metodo: cantidad de ventas, monto cobrado y
 * porcentaje del monto total (redondeado a 2 decimales en la BD, sin errores de coma flotante).
 */
async function agruparPorMetodo({ desde, hasta }) {
  const { rows } = await query(
    `WITH ${CTE_FILAS}
     SELECT f.metodo,
            COUNT(DISTINCT f.id_transaccion)::int                                   AS cantidad,
            SUM(f.monto)                                                            AS monto,
            ROUND(100 * SUM(f.monto) / NULLIF(SUM(SUM(f.monto)) OVER (), 0), 2)     AS porcentaje
       FROM filas f
       JOIN cobradas c ON c.id_transaccion = f.id_transaccion
      GROUP BY f.metodo`,
    [desde, hasta]
  );
  return rows.map((r) => ({ metodo: r.metodo, cantidad: r.cantidad, monto: num(r.monto), porcentaje: num(r.porcentaje) }));
}

module.exports = { agruparPorMetodo };