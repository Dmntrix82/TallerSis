const { pool, query } = require("../config/db");

// TDSI-197: detalle del arqueo de efectivo (billetes y monedas) de cada turno.

const aFila = (r) => ({
  denominacion: Number(r.denominacion),
  cantidad: Number(r.cantidad),
  subtotal: Number(r.subtotal),
});

/** Denominaciones contadas en el turno, de mayor a menor valor. */
async function listarPorTurno(turnoId) {
  const { rows } = await query(
    `SELECT denominacion, cantidad, subtotal
       FROM caja.arqueo_denominaciones
      WHERE turno_id = $1
      ORDER BY denominacion DESC`,
    [turnoId]
  );
  return rows.map(aFila);
}

/**
 * Guarda el arqueo del turno reemplazando el anterior (si el cierre se reintenta,
 * no quedan filas duplicadas ni mezcladas). Todo en una sola transaccion.
 * filas: [{ denominacion, cantidad, subtotal }]
 */
async function reemplazarArqueo(turnoId, filas) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM caja.arqueo_denominaciones WHERE turno_id = $1", [turnoId]);
    for (const f of filas) {
      await client.query(
        `INSERT INTO caja.arqueo_denominaciones (turno_id, denominacion, cantidad, subtotal)
         VALUES ($1, $2, $3, $4)`,
        [turnoId, f.denominacion, f.cantidad, f.subtotal]
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  return listarPorTurno(turnoId);
}

module.exports = { listarPorTurno, reemplazarArqueo };
