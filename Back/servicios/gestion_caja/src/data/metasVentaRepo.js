const { query } = require("../config/db");

const num = (v) => (v === null || v === undefined ? v : Number(v));

function normalizar(r) {
  if (!r) return null;
  return { ...r, monto_meta: num(r.monto_meta) };
}

/**
 * TDSI-58/193/773: "Editar meta" -- una caja tiene a lo sumo una meta vigente
 * (UNIQUE sobre caja_id), asi que fijarla de nuevo actualiza la misma fila.
 */
async function guardarMeta(cajaId, { montoMeta, actualizadoPor }) {
  const { rows } = await query(
    `INSERT INTO caja.metas_venta (caja_id, monto_meta, actualizado_por)
     VALUES ($1, $2, $3)
     ON CONFLICT (caja_id) DO UPDATE
       SET monto_meta = EXCLUDED.monto_meta,
           actualizado_por = EXCLUDED.actualizado_por,
           actualizado_en = now()
     RETURNING *`,
    [cajaId, montoMeta, actualizadoPor || null]
  );
  return normalizar(rows[0]);
}

async function obtenerPorCaja(cajaId) {
  const { rows } = await query(`SELECT * FROM caja.metas_venta WHERE caja_id = $1`, [cajaId]);
  return normalizar(rows[0]);
}

/** TDSI-58/774: todas las metas cargadas, para cruzarlas con lo recaudado de cada caja. */
async function listarTodas() {
  const { rows } = await query(`SELECT * FROM caja.metas_venta`);
  return rows.map(normalizar);
}

module.exports = { guardarMeta, obtenerPorCaja, listarTodas };
