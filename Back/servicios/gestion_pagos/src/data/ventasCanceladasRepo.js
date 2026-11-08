const { query } = require("../config/db");

const num = (v) => (v === null || v === undefined ? v : Number(v));

function normalizar(r) {
  if (!r) return null;
  return { ...r, id: num(r.id), total: num(r.total) };
}

/** TDSI-838: Guarda el registro de una venta cancelada. */
async function registrar({ cajero_id, caja_id, turno_id, items, total, motivo, motivo_texto }) {
  // IMPORTANTE: Convertir el arreglo de items a string JSON para evitar el error 22P02 de Postgres
  const itemsJson = JSON.stringify(items);

  const { rows } = await query(
    `INSERT INTO pagos.ventas_canceladas 
      (cajero_id, caja_id, turno_id, items, total, motivo, motivo_texto)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [cajero_id, caja_id, turno_id, itemsJson, total, motivo, motivo_texto]
  );
  return normalizar(rows[0]);
}

/**
 * TDSI-839: Cuenta cuántas ventas canceló un cajero hoy (o en una fecha específica).
 * "Hoy" sin fecha se calcula en hora de Bolivia (America/La_Paz), no con CURRENT_DATE:
 * la sesión de Postgres corre en UTC, que ya cambia de día 4 horas antes que Bolivia
 * (a las 20:00). Con CURRENT_DATE, una cancelación hecha entre las 20:00 y la medianoche
 * en Bolivia no se contaba como "hoy" si se consultaba sin fecha en ese mismo rato.
 */
async function contarHoy(cajero_id, fecha = null) {
  const params = [cajero_id];
  let filtroFecha = `(creado_en AT TIME ZONE 'America/La_Paz')::date = (now() AT TIME ZONE 'America/La_Paz')::date`;

  if (fecha) {
    params.push(fecha);
    filtroFecha = `(creado_en AT TIME ZONE 'America/La_Paz')::date = $2::date`;
  }

  const { rows } = await query(
    `SELECT COUNT(*)::int AS total
       FROM pagos.ventas_canceladas
      WHERE cajero_id = $1 AND ${filtroFecha}`,
    params
  );
  return rows[0].total;
}

module.exports = { registrar, contarHoy };