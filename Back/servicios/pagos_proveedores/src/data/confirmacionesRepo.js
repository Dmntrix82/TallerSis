const { query } = require("../config/db");
const { withTransaction } = require("./transaccion");

async function crearConfirmacion(ordenId, usuario, validar, construirPayload) {
  return withTransaction(async (c) => {
    const { rows } = await c.query(
      `SELECT id, numero, estado, confirmado_en, confirmado_por
       FROM proveedores.ordenes_pago WHERE id = $1 FOR UPDATE`,
      [ordenId]
    );
    const orden = rows[0] || null;
    validar(orden);

    const activa = await c.query(
      `SELECT id, estado FROM proveedores.confirmaciones_compras
       WHERE orden_pago_id = $1 AND estado IN ('PENDIENTE','ENVIADO')`,
      [ordenId]
    );
    if (activa.rows[0]) return { yaExiste: activa.rows[0] };

    const ins = await c.query(
      `INSERT INTO proveedores.confirmaciones_compras
         (orden_pago_id, solicitado_por, payload, proximo_intento_en)
       VALUES ($1, $2, $3, now() + interval '2 minutes')
       RETURNING id, orden_pago_id, solicitado_por, payload, intentos`,
      [ordenId, usuario, JSON.stringify(construirPayload(orden))]
    );
    return { confirmacion: ins.rows[0] };
  });
}

async function marcarEnviada(conf, status) {
  return withTransaction(async (c) => {
    await c.query(
      `UPDATE proveedores.confirmaciones_compras
       SET estado = 'ENVIADO', intentos = intentos + 1, ultimo_status = $2,
           ultimo_error = NULL, enviado_en = now()
       WHERE id = $1`,
      [conf.id, status]
    );

    const { rows } = await c.query(
      `UPDATE proveedores.ordenes_pago
       SET confirmado_por = $2, confirmado_en = now()
       WHERE id = $1
       RETURNING id, estado, confirmado_por, confirmado_en`,
      [conf.orden_pago_id, conf.solicitado_por]
    );
    return rows[0];
  });
}

async function registrarFallo(conf, resultado, maxIntentos, backoffBaseSeg) {
  const { rows } = await query(
    `UPDATE proveedores.confirmaciones_compras
     SET intentos = intentos + 1,
         ultimo_status = $2,
         ultimo_error = $3,
         estado = CASE WHEN NOT $4::boolean OR intentos + 1 >= $5::int
                       THEN 'ERROR' ELSE 'PENDIENTE' END,
         proximo_intento_en = now() + make_interval(secs => $6::int * power(2, intentos))
     WHERE id = $1
     RETURNING estado, intentos, proximo_intento_en, ultimo_error`,
    [conf.id, resultado.status, resultado.error?.slice(0, 400), resultado.reintentable, maxIntentos, backoffBaseSeg]
  );
  return rows[0];
}

async function tomarPendientes(limite = 10) {
  const { rows } = await query(
    `UPDATE proveedores.confirmaciones_compras
     SET proximo_intento_en = now() + interval '2 minutes'
     WHERE id IN (
       SELECT id FROM proveedores.confirmaciones_compras
       WHERE estado = 'PENDIENTE' AND proximo_intento_en <= now()
       ORDER BY proximo_intento_en
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING id, orden_pago_id, solicitado_por, payload, intentos`,
    [limite]
  );
  return rows;
}

async function ultimaConfirmacion(ordenId) {
  const { rows } = await query(
    `SELECT id, estado, solicitado_por, intentos, ultimo_status, ultimo_error,
            proximo_intento_en, creado_en, enviado_en
     FROM proveedores.confirmaciones_compras
     WHERE orden_pago_id = $1 ORDER BY creado_en DESC LIMIT 1`,
    [ordenId]
  );
  return rows[0] || null;
}

module.exports = { crearConfirmacion, marcarEnviada, registrarFallo, tomarPendientes, ultimaConfirmacion };