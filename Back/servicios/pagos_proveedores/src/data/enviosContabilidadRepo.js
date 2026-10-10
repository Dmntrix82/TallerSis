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
 * TDSI-422: proximo_intento_en queda 2 minutos adelante como respaldo: si el primer
 * intento nunca termina (el servicio se cae a mitad), el worker lo retoma.
 */
async function crearEnvio({ loteId, payload, solicitadoPor }) {
  const { rows } = await query(
    `INSERT INTO proveedores.envios_contabilidad
       (lote_id, estado, intentos, payload, solicitado_por, proximo_intento_en)
     VALUES ($1, 'PENDIENTE', 0, $2, $3, now() + interval '2 minutes')
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

/**
 * TDSI-421/422: el intento fallo -> se guarda el error.
 * Si Contabilidad no respondio (reintentable) y quedan intentos, el envio sigue PENDIENTE
 * y se programa el proximo intento con espera creciente (base, base*2, base*4...).
 * Si ya se usaron los maxIntentos, o Contabilidad rechazo el reporte (4xx), queda en ERROR.
 */
async function registrarFallo(envio, resultado, maxIntentos, backoffBaseSeg) {
  await query(
    `UPDATE proveedores.envios_contabilidad
     SET intentos = intentos + 1,
         ultimo_intento_en = now(),
         ultimo_status = $2,
         ultimo_error = $3,
         estado = CASE WHEN NOT $4::boolean OR intentos + 1 >= $5::int THEN 'ERROR' ELSE 'PENDIENTE' END,
         proximo_intento_en = CASE WHEN NOT $4::boolean OR intentos + 1 >= $5::int THEN NULL
                                   ELSE now() + make_interval(secs => $6::int * power(2, intentos)) END
     WHERE id = $1`,
    [
      envio.id,
      resultado.status ?? null,
      String(resultado.error || "Error desconocido").slice(0, 400),
      Boolean(resultado.reintentable),
      maxIntentos,
      backoffBaseSeg,
    ]
  );
  return obtenerPorId(envio.id);
}

/**
 * TDSI-422: toma los envios PENDIENTES cuyo proximo intento ya vencio y los "reserva"
 * 2 minutos (FOR UPDATE SKIP LOCKED), asi dos workers nunca envian el mismo a la vez.
 * loteId solo se usa en las pruebas, para no tocar envios de otros datos.
 */
async function tomarPendientes(limite = 10, { loteId = null } = {}) {
  const { rows } = await query(
    `UPDATE proveedores.envios_contabilidad
     SET proximo_intento_en = now() + interval '2 minutes'
     WHERE id IN (
       SELECT id FROM proveedores.envios_contabilidad
       WHERE estado = 'PENDIENTE' AND proximo_intento_en <= now()
         AND ($2::bigint IS NULL OR lote_id = $2)
       ORDER BY proximo_intento_en
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING id, lote_id, payload, intentos`,
    [limite, loteId]
  );
  return rows.map(aEnvio);
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

module.exports = { obtenerPorId, obtenerPorLote, crearEnvio, marcarEnviado, registrarFallo, tomarPendientes, listar };