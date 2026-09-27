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
 *
 * TDSI-333: filtro opcional por rango de horas del dia (formato "HH:MM"), sobre
 * la columna `fecha` de pagos.transacciones. Con desde/hasta en null no filtra nada.
 *
 * Soporta turnos que cruzan la medianoche (ej. "Noche" 18:00-00:00): si
 * desde > hasta, el rango se interpreta como [desde, 24:00) U [00:00, hasta]
 * en vez de un intervalo normal.
 */
async function resumenPorMetodo(turnoId, { desde = null, hasta = null } = {}) {
  const { rows } = await query(
    `SELECT metodo, COALESCE(SUM(monto), 0) AS total, COUNT(DISTINCT id_transaccion)::int AS cantidad
     FROM (
       SELECT metodo, monto, id_transaccion, fecha
       FROM pagos.transacciones
       WHERE estado = 'Registrado' AND turno_id = $1

       UNION ALL

       SELECT t.metodo, t.monto, t.id_transaccion, t.fecha
       FROM pagos.transacciones t
       JOIN pagos.pagos_mixtos pm ON pm.id = t.pago_mixto_id
       WHERE t.estado = 'Registrado' AND pm.turno_id = $1
     ) ventas_turno
     WHERE
       CASE
         WHEN $2::time IS NULL AND $3::time IS NULL THEN true
         WHEN $2::time IS NOT NULL AND $3::time IS NOT NULL AND $2::time > $3::time
           -- rango que cruza la medianoche (ej. Noche: 18:00 a 00:00)
           THEN (fecha AT TIME ZONE 'America/La_Paz')::time >= $2::time
             OR (fecha AT TIME ZONE 'America/La_Paz')::time <= $3::time
         ELSE
           ($2::time IS NULL OR (fecha AT TIME ZONE 'America/La_Paz')::time >= $2::time)
           AND ($3::time IS NULL OR (fecha AT TIME ZONE 'America/La_Paz')::time <= $3::time)
       END
     GROUP BY metodo
     ORDER BY metodo`,
    [turnoId, desde, hasta]
  );
  return rows.map((r) => ({ ...r, total: num(r.total) }));
}

module.exports = { resumenPorMetodo };
