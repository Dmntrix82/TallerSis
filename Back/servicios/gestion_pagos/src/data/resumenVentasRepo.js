const { query } = require("../config/db");

const num = (v) => (v === null || v === undefined ? v : Number(v));

/**
 * TDSI-101/327/328/329/330: ventas del turno agrupadas por metodo de pago.
 * Cubre pagos simples (turno_id propio) y mixtos (turno_id vive en pagos_mixtos).
 *
 * TDSI-330: se separa en dos consultas unidas con UNION ALL en vez de un
 * "OR" entre columnas de tablas distintas -- ese patron le impide a Postgres
 * usar un indice (igual que el problema de TDSI-377), aqui cada mitad puede
 * usar su propio indice (idx_transacciones_estado_turno / idx_pagos_mixtos_turno_id).
 */
async function resumenPorMetodo(turnoId) {
  const { rows } = await query(
    `SELECT metodo, COALESCE(SUM(monto), 0) AS total, COUNT(DISTINCT id_transaccion)::int AS cantidad
     FROM (
       SELECT metodo, monto, id_transaccion
       FROM pagos.transacciones
       WHERE estado = 'Registrado' AND turno_id = $1

       UNION ALL

       SELECT t.metodo, t.monto, t.id_transaccion
       FROM pagos.transacciones t
       JOIN pagos.pagos_mixtos pm ON pm.id = t.pago_mixto_id
       WHERE t.estado = 'Registrado' AND pm.turno_id = $1
     ) ventas_turno
     GROUP BY metodo
     ORDER BY metodo`,
    [turnoId]
  );
  return rows.map((r) => ({ ...r, total: num(r.total) }));
}

module.exports = { resumenPorMetodo };
