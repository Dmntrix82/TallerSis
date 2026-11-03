const { query } = require("../config/db");
const num = (v) => (v === null || v === undefined ? v : Number(v));

/** Normaliza la fila (monto a number, id a number) */
function normalizar(r) {
  if (!r) return null;
  return { ...r, id: num(r.id), turno_id: num(r.turno_id), monto: num(r.monto) };
}

/** TDSI-487: registra una diferencia al cerrar el turno */
async function insertar({ turno_id, monto, tipo }) {
  const { rows } = await query(
    `INSERT INTO caja.diferencias_resolucion (turno_id, monto, tipo, estado)
     VALUES ($1, $2, $3, 'PENDIENTE')
     RETURNING *`,
    [turno_id, monto, tipo]
  );
  return normalizar(rows[0]);
}

/** TDSI-492: diferencias registradas en un conjunto de turnos. */
async function listarPorTurnos(turnoIds) {
  if (!turnoIds.length) return [];
  const { rows } = await query(
    `SELECT id, turno_id, monto, tipo, estado, justificacion, resuelta_por, resuelta_en
       FROM caja.diferencias_resolucion
      WHERE turno_id = ANY($1::bigint[])
      ORDER BY turno_id, id`,
    [turnoIds]
  );
  return rows.map(normalizar);
}

/**
 * TDSI-698: la diferencia junto con los datos del turno que necesita el mensaje de
 * Contabilidad (caja, cajero, fecha de cierre) -- un solo viaje a la base.
 */
async function obtenerConTurno(id) {
  const { rows } = await query(
    `SELECT d.id, d.turno_id, d.monto, d.tipo, d.estado, d.justificacion, d.resuelta_por, d.resuelta_en,
            t.caja_id, t.cajero_id, t.cajero_nombre, t.abierto_en, t.cerrado_en
       FROM caja.diferencias_resolucion d
       JOIN caja.turnos t ON t.id = d.turno_id
      WHERE d.id = $1`,
    [id]
  );
  const r = rows[0];
  if (!r) return null;
  return {
    diferencia: normalizar({ id: r.id, turno_id: r.turno_id, monto: r.monto, tipo: r.tipo, estado: r.estado, justificacion: r.justificacion, resuelta_por: r.resuelta_por, resuelta_en: r.resuelta_en }),
    turno: { caja_id: r.caja_id, cajero_id: r.cajero_id, cajero_nombre: r.cajero_nombre, abierto_en: r.abierto_en, cerrado_en: r.cerrado_en },
  };
}

/**
 * TDSI-52/698: el Administrador resuelve la diferencia con su justificacion. Solo
 * actualiza si seguia PENDIENTE (si ya se resolvio -- p.ej. dos clics -- no pisa nada).
 */
async function resolver(id, { justificacion, resuelta_por }) {
  const { rows } = await query(
    `UPDATE caja.diferencias_resolucion
        SET justificacion = $2, resuelta_por = $3, resuelta_en = now(), estado = 'RESUELTA'
      WHERE id = $1 AND estado = 'PENDIENTE'
      RETURNING *`,
    [id, justificacion, resuelta_por || null]
  );
  return normalizar(rows[0]);
}

/**
 * TDSI-52/701: "Diferencias de caja" del Administrador, con el estado del aviso a
 * Contabilidad (null si todavia no se resolvio -- no hay envio hasta que se resuelve).
 */
async function listar({ estado } = {}) {
  const { rows } = await query(
    `SELECT d.id, d.turno_id, d.monto, d.tipo, d.estado, d.justificacion, d.resuelta_por, d.resuelta_en,
            t.caja_id, t.cajero_nombre, t.cajero_id, t.cerrado_en,
            e.estado AS envio_estado, e.motivo_rechazo AS envio_motivo_rechazo,
            e.intentos AS envio_intentos, e.ultimo_error AS envio_ultimo_error
       FROM caja.diferencias_resolucion d
       JOIN caja.turnos t ON t.id = d.turno_id
       LEFT JOIN caja.diferencias_envios_contabilidad e ON e.diferencia_id = d.id
      WHERE ($1::varchar IS NULL OR d.estado = $1)
      ORDER BY d.id DESC`,
    [estado || null]
  );
  return rows.map((r) => ({
    id: num(r.id),
    turno_id: num(r.turno_id),
    caja_id: r.caja_id,
    cajero: r.cajero_nombre || r.cajero_id,
    tipo: r.tipo,
    monto: num(r.monto),
    estado: r.estado,
    justificacion: r.justificacion,
    resuelta_por: r.resuelta_por,
    resuelta_en: r.resuelta_en,
    cerrado_en: r.cerrado_en,
    contabilidad: r.envio_estado
      ? { estado: r.envio_estado, motivo_rechazo: r.envio_motivo_rechazo, intentos: r.envio_intentos, ultimo_error: r.envio_ultimo_error }
      : null,
  }));
}

module.exports = { listarPorTurnos, insertar, obtenerConTurno, resolver, listar };
