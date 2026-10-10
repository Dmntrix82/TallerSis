const { query } = require("../config/db");
const { withTransaction } = require("./transaccion");

const COLUMNAS = `e.id, e.lote_id, l.fecha::text AS fecha, e.estado, e.intentos, e.solicitado_por,
                  e.ultimo_intento_en, e.ultimo_status, e.ultimo_error, e.referencia_contabilidad,
                  e.proximo_intento_en, e.enviado_en, e.creado_en`;

function aEnvio(fila) {
  if (!fila) return null;
  return { ...fila, id: Number(fila.id), lote_id: Number(fila.lote_id) };
}

async function obtenerPorId(id, { conPayload = false } = {}) {
  const { rows } = await query(
    `SELECT ${COLUMNAS}${conPayload ? ", e.payload" : ""}
     FROM proveedores.envios_contabilidad e
     JOIN proveedores.lotes_cierre_diario l ON l.id = e.lote_id
     WHERE e.id = $1`,
    [id]
  );
  return aEnvio(rows[0]);
}

async function obtenerPorLote(loteId) {
  const { rows } = await query(
    `SELECT ${COLUMNAS}
     FROM proveedores.envios_contabilidad e
     JOIN proveedores.lotes_cierre_diario l ON l.id = e.lote_id
     WHERE e.lote_id = $1`,
    [loteId]
  );
  return aEnvio(rows[0]);
}

/**
 * TDSI-421: registra el envio del reporte de un lote (estado PENDIENTE, 0 intentos).
 * Un lote tiene un solo envio (uq_envio_por_lote): si ya existe devuelve { yaExiste }.
 */
async function crearEnvio({ loteId, payload, solicitadoPor }) {
  const { rows } = await query(
    `INSERT INTO proveedores.envios_contabilidad (lote_id, estado, intentos, payload, solicitado_por)
     VALUES ($1, 'PENDIENTE', 0, $2, $3)
     ON CONFLICT (lote_id) DO NOTHING
     RETURNING id`,
    [loteId, JSON.stringify(payload), solicitadoPor]
  );
  if (!rows[0]) return { yaExiste: await obtenerPorLote(loteId) };
  return { envio: await obtenerPorId(rows[0].id, { conPayload: true }) };
}

/** TDSI-421: Contabilidad recibio el reporte -> envio ENVIADO y el lote pasa a ENVIADO. */
async function marcarEnviado(envio, { status, referencia }) {
  await withTransaction(async (c) => {
    await c.query(
      `UPDATE proveedores.envios_contabilidad
       SET estado = 'ENVIADO', intentos = intentos + 1, ultimo_intento_en = now(),
           ultimo_status = $2, ultimo_error = NULL, referencia_contabilidad = $3,
           proximo_intento_en = NULL, enviado_en = now()
       WHERE id = $1`,
      [envio.id, status ?? null, referencia ?? null]
    );
    await c.query(
      `UPDATE proveedores.lotes_cierre_diario SET estado = 'ENVIADO'
       WHERE id = $1 AND estado = 'GENERADO'`,
      [envio.lote_id]
    );
  });
  return obtenerPorId(envio.id);
}

/** TDSI-421: el intento fallo -> se guarda el error y el envio queda en ERROR. */
async function registrarFallo(envio, resultado) {
  await query(
    `UPDATE proveedores.envios_contabilidad
     SET estado = 'ERROR', intentos = intentos + 1, ultimo_intento_en = now(),
         ultimo_status = $2, ultimo_error = $3, proximo_intento_en = NULL
     WHERE id = $1`,
    [envio.id, resultado.status ?? null, String(resultado.error || "Error desconocido").slice(0, 400)]
  );
  return obtenerPorId(envio.id);
}

/** TDSI-421: envios registrados, del mas reciente al mas antiguo (para la seccion "Envios a Contabilidad"). */
async function listar({ estado = null, limite = 50 } = {}) {
  const { rows } = await query(
    `SELECT ${COLUMNAS}
     FROM proveedores.envios_contabilidad e
     JOIN proveedores.lotes_cierre_diario l ON l.id = e.lote_id
     WHERE $1::text IS NULL OR e.estado = $1
     ORDER BY e.creado_en DESC, e.id DESC
     LIMIT $2`,
    [estado, limite]
  );
  return rows.map(aEnvio);
}

module.exports = { obtenerPorId, obtenerPorLote, crearEnvio, marcarEnviado, registrarFallo, listar };