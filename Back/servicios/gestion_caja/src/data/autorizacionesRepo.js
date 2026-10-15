const { query } = require("../config/db");

const num = (v) => (v === null || v === undefined ? v : Number(v));

/** Normaliza una fila de caja.autorizaciones: convierte NUMERIC/BIGINT a number. */
function normalizar(r) {
  if (!r) return null;
  return {
    ...r,
    id: num(r.id),                         
    efectivo_inicial: num(r.efectivo_inicial),
    efectivo_contado: num(r.efectivo_contado),
    turno_id: num(r.turno_id),
  };
}

/** TDSI-467: crea una solicitud de apertura en estado PENDIENTE. */
async function crearSolicitud({ caja_id, cajero_id, cajero_nombre, efectivo_inicial }) {
  const { rows } = await query(
    `INSERT INTO caja.autorizaciones
       (tipo, caja_id, cajero_id, cajero_nombre, efectivo_inicial, solicitado_por, estado)
     VALUES ('APERTURA', $1, $2, $3, $4, $2, 'PENDIENTE')
     RETURNING *`,
    [caja_id, cajero_id, cajero_nombre || null, efectivo_inicial]
  );
  return normalizar(rows[0]);
}

/** Busca una solicitud PENDIENTE de la misma caja para evitar duplicados. */
async function buscarPendientePorCaja(caja_id) {
  const { rows } = await query(
    `SELECT * FROM caja.autorizaciones
      WHERE caja_id = $1 AND tipo = 'APERTURA' AND estado = 'PENDIENTE'
      LIMIT 1`,
    [caja_id]
  );
  return normalizar(rows[0]);
}

/** TDSI-582: lista todas las solicitudes PENDIENTES de apertura. */
async function listarPendientes() {
  const { rows } = await query(
    `SELECT * FROM caja.autorizaciones
      WHERE estado = 'PENDIENTE'
      ORDER BY solicitado_en ASC`
  );
  return rows.map(normalizar);
}

async function obtenerPorId(id) {
  const { rows } = await query(
    `SELECT * FROM caja.autorizaciones WHERE id = $1`,
    [id]
  );
  return normalizar(rows[0]);
}

/** TDSI-468/605: aprueba la solicitud y le asocia el turno creado. */
async function marcarAprobada(id, { autorizado_por, autorizado_por_nombre, turno_id }) {
  const { rows } = await query(
    `UPDATE caja.autorizaciones
        SET estado = 'APROBADA',
            autorizado_por = $2,
            autorizado_por_nombre = $3,
            turno_id = $4,
            resuelto_en = now()
      WHERE id = $1
      RETURNING *`,
    [id, autorizado_por, autorizado_por_nombre, turno_id]
  );
  return normalizar(rows[0]);
}

/** TDSI-468/604: rechaza la solicitud con motivo obligatorio. */
async function marcarRechazada(id, { autorizado_por, autorizado_por_nombre, motivo_rechazo }) {
  const { rows } = await query(
    `UPDATE caja.autorizaciones
        SET estado = 'RECHAZADA',
            autorizado_por = $2,
            autorizado_por_nombre = $3,
            motivo_rechazo = $4,
            resuelto_en = now()
      WHERE id = $1
      RETURNING *`,
    [id, autorizado_por, autorizado_por_nombre, motivo_rechazo]
  );
  return normalizar(rows[0]);
}
/** TDSI-471: crea una solicitud de cierre en estado PENDIENTE. */
async function crearSolicitudCierre({ caja_id, turno_id, cajero_id, cajero_nombre, efectivo_contado }) {
  const { rows } = await query(
    `INSERT INTO caja.autorizaciones
       (tipo, caja_id, turno_id, cajero_id, cajero_nombre, efectivo_contado, solicitado_por, estado)
     VALUES ('CIERRE', $1, $2, $3, $4, $5, $3, 'PENDIENTE')
     RETURNING *`,
    [caja_id, turno_id, cajero_id, cajero_nombre || null, efectivo_contado]
  );
  return normalizar(rows[0]);
}

/** Busca una solicitud PENDIENTE de CIERRE para el mismo turno (evita duplicados). */
async function buscarPendientePorTurno(turno_id) {
  const { rows } = await query(
    `SELECT * FROM caja.autorizaciones
      WHERE turno_id = $1 AND tipo = 'CIERRE' AND estado = 'PENDIENTE'
      LIMIT 1`,
    [turno_id]
  );
  return normalizar(rows[0]);
}

module.exports = {
  crearSolicitud,
  crearSolicitudCierre,
  buscarPendientePorCaja,
  buscarPendientePorTurno, 
  listarPendientes,
  obtenerPorId,
  marcarAprobada,
  marcarRechazada,
};