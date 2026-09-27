const { query } = require("../config/db");

const num = (v) => (v === null || v === undefined ? v : Number(v));

/**
 * TDSI-101/327/328/329: ventas del turno agrupadas por metodo de pago.
 * Cubre pagos simples (turno_id propio) y mixtos (turno_id vive en pagos_mixtos,
 * se une por pago_mixto_id) -- mismo patron que el desglose por caja del tablero.
 */
async function resumenPorMetodo(turnoId) {
  const { rows } = await query(
    `SELECT t.metodo,
            COALESCE(SUM(t.monto), 0) AS total,
            COUNT(DISTINCT t.id_transaccion)::int AS cantidad
     FROM pagos.transacciones t
     LEFT JOIN pagos.pagos_mixtos pm ON pm.id = t.pago_mixto_id
     WHERE t.estado = 'Registrado'
       AND (t.turno_id = $1 OR pm.turno_id = $1)
     GROUP BY t.metodo
     ORDER BY t.metodo`,
    [turnoId]
  );
  return rows.map((r) => ({ ...r, total: num(r.total) }));
}

module.exports = { resumenPorMetodo };
