const { query } = require("../config/db");

const num = (v) => (v === null || v === undefined ? v : Number(v));

/**
 * TDSI-57/191: ventas agrupadas por hora del dia (0-23) en hora de Bolivia, con
 * cantidad y monto, en un rango [desde, hasta). "Decidir cuantas cajas abrir" solo
 * tiene sentido para caja fisica (las ventas online no se reparten en cajas), por eso
 * esto cuenta pagos.transacciones y no las ventas online -- a diferencia de otras
 * consultas del Tablero que suman ambas fuentes.
 * Todavia sin el filtro por caja (TDSI-760) ni sin excluir las anuladas (TDSI-761):
 * esos son subtasks aparte.
 */
async function ventasPorHoraEnRango(desde, hasta) {
  const { rows } = await query(
    `SELECT EXTRACT(HOUR FROM fecha AT TIME ZONE 'America/La_Paz')::int AS hora,
            COUNT(DISTINCT id_transaccion)::int AS cantidad,
            COALESCE(SUM(monto), 0) AS monto
       FROM pagos.transacciones
      WHERE fecha >= $1 AND fecha < $2
      GROUP BY hora
      ORDER BY hora`,
    [desde, hasta]
  );
  return rows.map((r) => ({ hora: r.hora, cantidad: r.cantidad, monto: num(r.monto) }));
}

module.exports = { ventasPorHoraEnRango };
