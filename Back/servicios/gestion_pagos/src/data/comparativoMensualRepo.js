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

module.exports = { totalVendidoEnRango };
