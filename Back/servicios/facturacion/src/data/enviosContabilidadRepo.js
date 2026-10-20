const { query } = require("../config/db");

// TDSI-22: control de los envios de facturas a Contabilidad (facturacion.factura_envios_contabilidad).
const COLUMNAS = `e.id, e.factura_id, f.numero AS factura_numero, e.tipo, e.estado, e.intentos,
                  e.ultimo_intento_en, e.ultimo_error, e.pubsub_message_id, e.proximo_intento_en,
                  e.enviado_en, e.creado_en`;

function aEnvio(fila) {
  if (!fila) return null;
  return { ...fila, id: Number(fila.id), factura_id: Number(fila.factura_id) };
}

async function obtener(id, { conPayload = false } = {}) {
  const { rows } = await query(
    `SELECT ${COLUMNAS}${conPayload ? ", e.payload" : ""}
     FROM facturacion.factura_envios_contabilidad e
     JOIN facturacion.facturas f ON f.id = e.factura_id
     WHERE e.id = $1`,
    [id]
  );
  return aEnvio(rows[0]);
}

async function obtenerPorFactura(facturaId, tipo) {
  const { rows } = await query(
    `SELECT ${COLUMNAS}
     FROM facturacion.factura_envios_contabilidad e
     JOIN facturacion.facturas f ON f.id = e.factura_id
     WHERE e.factura_id = $1 AND e.tipo = $2`,
    [facturaId, tipo]
  );
  return aEnvio(rows[0]);
}

/**
 * Registra el envio (Pendiente, 0 intentos) con el mensaje que se va a publicar.
 * uq_envio_factura_tipo: una factura tiene un solo envio por tipo; si ya existe devuelve { yaExiste }.
 * proximo_intento_en queda 2 minutos adelante: si el primer intento nunca termina, el worker lo retoma.
 */
async function crear({ facturaId, tipo, payload }) {
  const { rows } = await query(
    `INSERT INTO facturacion.factura_envios_contabilidad
       (factura_id, tipo, estado, intentos, payload, proximo_intento_en)
     VALUES ($1, $2, 'Pendiente', 0, $3, now() + interval '2 minutes')
     ON CONFLICT (factura_id, tipo) DO NOTHING
     RETURNING id`,
    [facturaId, tipo, JSON.stringify(payload)]
  );
  if (!rows[0]) return { yaExiste: await obtenerPorFactura(facturaId, tipo) };
  return { envio: await obtener(rows[0].id, { conPayload: true }) };
}

async function marcarEnviado(id, messageId) {
  await query(
    `UPDATE facturacion.factura_envios_contabilidad
     SET estado = 'Enviado', intentos = intentos + 1, ultimo_intento_en = now(),
         ultimo_error = NULL, pubsub_message_id = $2, proximo_intento_en = NULL, enviado_en = now()
     WHERE id = $1`,
    [id, messageId]
  );
  return obtener(id);
}

/**
 * El intento fallo: si es reintentable y quedan intentos sigue Pendiente con espera
 * creciente (base, base*2, base*4...); si no, queda en Error.
 */
async function registrarFallo(id, { error, reintentable }, maxIntentos, backoffBaseSeg) {
  await query(
    `UPDATE facturacion.factura_envios_contabilidad
     SET intentos = intentos + 1,
         ultimo_intento_en = now(),
         ultimo_error = $2,
         estado = CASE WHEN NOT $3::boolean OR intentos + 1 >= $4::int THEN 'Error' ELSE 'Pendiente' END,
         proximo_intento_en = CASE WHEN NOT $3::boolean OR intentos + 1 >= $4::int THEN NULL
                                   ELSE now() + make_interval(secs => $5::int * power(2, intentos)) END
     WHERE id = $1`,
    [id, String(error || "Error desconocido").slice(0, 400), Boolean(reintentable), maxIntentos, backoffBaseSeg]
  );
  return obtener(id);
}

/** Toma los Pendientes vencidos y los reserva 2 minutos (SKIP LOCKED: dos workers nunca toman el mismo). */
async function tomarPendientes(limite = 10, { facturaId = null } = {}) {
  const { rows } = await query(
    `UPDATE facturacion.factura_envios_contabilidad
     SET proximo_intento_en = now() + interval '2 minutes'
     WHERE id IN (
       SELECT id FROM facturacion.factura_envios_contabilidad
       WHERE estado = 'Pendiente' AND proximo_intento_en <= now()
         AND ($2::bigint IS NULL OR factura_id = $2)
       ORDER BY proximo_intento_en
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING id, factura_id, tipo, payload, intentos`,
    [limite, facturaId]
  );
  return rows.map(aEnvio);
}

/** "Reenviar" un envio en Error: misma fila, nuevo ciclo de intentos. Null si no estaba en Error. */
async function prepararReenvio(id) {
  const { rows } = await query(
    `UPDATE facturacion.factura_envios_contabilidad
     SET estado = 'Pendiente', intentos = 0, proximo_intento_en = now() + interval '2 minutes'
     WHERE id = $1 AND estado = 'Error'
     RETURNING id`,
    [id]
  );
  return rows[0] ? obtener(id, { conPayload: true }) : null;
}

async function listar({ estado = null, tipo = null, limite = 50 } = {}) {
  const { rows } = await query(
    `SELECT ${COLUMNAS}
     FROM facturacion.factura_envios_contabilidad e
     JOIN facturacion.facturas f ON f.id = e.factura_id
     WHERE ($1::text IS NULL OR e.estado = $1) AND ($2::text IS NULL OR e.tipo = $2)
     ORDER BY e.creado_en DESC, e.id DESC
     LIMIT $3`,
    [estado, tipo, limite]
  );
  return rows.map(aEnvio);
}

/** Datos de la factura que van en el mensaje (cabecera, items y metodos de pago). */
async function datosFactura(facturaId) {
  const { rows } = await query(`SELECT * FROM facturacion.facturas WHERE id = $1`, [facturaId]);
  if (!rows[0]) return null;
  const [items, metodos] = await Promise.all([
    query(
      `SELECT descripcion, cantidad, precio_unitario, subtotal
       FROM facturacion.factura_items WHERE factura_id = $1 ORDER BY id`,
      [facturaId]
    ),
    query(`SELECT metodo, monto FROM facturacion.factura_metodos_pago WHERE factura_id = $1 ORDER BY id`, [facturaId]),
  ]);
  return { ...rows[0], items: items.rows, metodosPago: metodos.rows };
}

/** Ultima anulacion autorizada de la factura (motivo, quien la pidio y quien la autorizo). */
async function anulacionAutorizada(facturaId) {
  const { rows } = await query(
    `SELECT id, motivo, solicitado_por, solicitado_en, autorizado_por, autorizado_nombre, autorizado_en, observacion
     FROM facturacion.factura_anulaciones
     WHERE factura_id = $1 AND estado = 'Autorizada'
     ORDER BY autorizado_en DESC NULLS LAST, id DESC
     LIMIT 1`,
    [facturaId]
  );
  return rows[0] || null;
}

module.exports = {
  obtener, obtenerPorFactura, crear, marcarEnviado, registrarFallo, tomarPendientes,
  prepararReenvio, listar, datosFactura, anulacionAutorizada,
};
