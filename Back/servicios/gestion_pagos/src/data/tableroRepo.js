const { query } = require("../config/db");

const num = (v) => (v === null || v === undefined ? v : Number(v));

/** TDSI-375: ingresos fisicos (pagos en el mostrador) del dia */
async function totalIngresosFisicosHoy() {
  const { rows } = await query(
    `SELECT COALESCE(SUM(monto), 0) AS total, COUNT(DISTINCT id_transaccion)::int AS cantidad
     FROM pagos.transacciones
     WHERE estado = 'Registrado' AND fecha::date = CURRENT_DATE`
  );
  return { total: num(rows[0].total), cantidad: rows[0].cantidad };
}

/** TDSI-375: ingresos virtuales (ventas online) del dia */
async function totalIngresosVirtualesHoy() {
  const { rows } = await query(
    `SELECT COALESCE(SUM(total), 0) AS total, COUNT(*)::int AS cantidad
     FROM pagos.ventas_online
     WHERE estado = 'Pagado' AND recibida_en::date = CURRENT_DATE`
  );
  return { total: num(rows[0].total), cantidad: rows[0].cantidad };
}

module.exports = { totalIngresosFisicosHoy, totalIngresosVirtualesHoy };
