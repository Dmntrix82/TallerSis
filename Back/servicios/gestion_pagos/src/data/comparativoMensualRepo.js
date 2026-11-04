const { query } = require("../config/db");

const num = (v) => (v === null || v === undefined ? v : Number(v));

/**
 * TDSI-56/189: total vendido (caja fisica + ventas online) en un rango [desde, hasta),
 * sin contar facturas anuladas -- mismo criterio que TDSI-375/376 del Tablero
 * (pagos.transacciones en 'Registrado' + pagos.ventas_online en 'Pagado').
 * El rango se arma afuera (mes completo, o "los mismos dias" del mes anterior para
 * TDSI-736), para poder reutilizar esta misma consulta en ambos casos.
 */
async function totalVendidoEnRango(desde, hasta) {
  const { rows } = await query(
    `SELECT
       COALESCE((SELECT SUM(monto) FROM pagos.transacciones
                  WHERE estado = 'Registrado' AND fecha >= $1 AND fecha < $2), 0)
       +
       COALESCE((SELECT SUM(total) FROM pagos.ventas_online
                  WHERE estado = 'Pagado' AND recibida_en >= $1 AND recibida_en < $2), 0)
       AS total`,
    [desde, hasta]
  );
  return num(rows[0].total);
}

/**
 * TDSI-56/734: desglose por caja (solo caja fisica -- las ventas online no tienen caja)
 * en un rango, sin contar anuladas. Mismo criterio que TDSI-376 del Tablero.
 */
async function totalesPorCajaEnRango(desde, hasta) {
  const { rows } = await query(
    `SELECT COALESCE(t.caja_id, pm.caja_id) AS caja_id,
            SUM(t.monto) AS total,
            COUNT(DISTINCT t.id_transaccion)::int AS cantidad
       FROM pagos.transacciones t
       LEFT JOIN pagos.pagos_mixtos pm ON pm.id = t.pago_mixto_id
      WHERE t.estado = 'Registrado' AND t.fecha >= $1 AND t.fecha < $2
        AND COALESCE(t.caja_id, pm.caja_id) IS NOT NULL
      GROUP BY COALESCE(t.caja_id, pm.caja_id)
      ORDER BY caja_id`,
    [desde, hasta]
  );
  return rows.map((r) => ({ caja_id: r.caja_id, total: num(r.total), cantidad: r.cantidad }));
}

/**
 * TDSI-56/734: desglose por metodo de pago en un rango, sin contar anuladas. Efectivo/
 * Tarjeta/QR son caja fisica; "Online" agrupa todas las ventas online en un solo bloque
 * (el ticket las pide como una 4ta columna, no desglosadas por su propio metodo_pago).
 */
async function totalesPorMetodoEnRango(desde, hasta) {
  const [{ rows: fisico }, { rows: online }] = await Promise.all([
    query(
      `SELECT metodo, SUM(monto) AS total
         FROM pagos.transacciones
        WHERE estado = 'Registrado' AND fecha >= $1 AND fecha < $2
        GROUP BY metodo`,
      [desde, hasta]
    ),
    query(
      `SELECT COALESCE(SUM(total), 0) AS total
         FROM pagos.ventas_online
        WHERE estado = 'Pagado' AND recibida_en >= $1 AND recibida_en < $2`,
      [desde, hasta]
    ),
  ]);

  const totales = { Efectivo: 0, Tarjeta: 0, QR: 0, Online: num(online[0].total) };
  for (const fila of fisico) totales[fila.metodo] = num(fila.total);
  return totales;
}

module.exports = { totalVendidoEnRango, totalesPorCajaEnRango, totalesPorMetodoEnRango };
