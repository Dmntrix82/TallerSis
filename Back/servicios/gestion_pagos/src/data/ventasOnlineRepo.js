const { query, withTransaction } = require("../config/db");

const num = (v) => (v === null || v === undefined ? v : Number(v));

async function existeOrden(ordenId) {
  const { rows } = await query(`SELECT 1 FROM pagos.ventas_online WHERE orden_id = $1`, [ordenId]);
  return rows.length > 0;
}

/** TDSI-51/179: guarda la venta (cabecera) + sus items en una sola transaccion SQL. */
async function guardarVenta({ ordenId, clienteId, nit, tipoDocumento, razonSocial, total, metodoPago, codigoConfirmacion }, items) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO pagos.ventas_online
         (orden_id, cliente_id, nit, tipo_documento, razon_social, total, metodo_pago, codigo_confirmacion)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (orden_id) DO NOTHING
       RETURNING *`,
      [ordenId, clienteId || null, nit || null, tipoDocumento || null, razonSocial || null, total, metodoPago, codigoConfirmacion]
    );
    const venta = rows[0];
    if (!venta) return null; // TDSI-51: ya existia (la orden llego dos veces) -- una orden = una venta

    for (const it of items) {
      await client.query(
        `INSERT INTO pagos.venta_online_items (venta_id, sku, descripcion, cantidad, precio_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [venta.id, it.sku, it.descripcion, it.cantidad, it.precioUnitario, it.subtotal]
      );
    }

    return { ...venta, total: num(venta.total) };
  });
}

/** TDSI-51/179: "si el mensaje viene mal, no se registra y se guarda el error para revisarlo". */
async function registrarMensajeInvalido({ messageId, error, payload }) {
  await query(
    `INSERT INTO pagos.marketplace_mensajes_error (message_id, error, payload) VALUES ($1, $2, $3)`,
    [messageId || null, error, payload || null]
  );
}

/** TDSI-51/683: la factura se emitio bien -- se guarda su numero y se limpia cualquier error anterior. */
async function guardarNumeroFactura(ventaId, numeroFactura) {
  await query(
    `UPDATE pagos.ventas_online SET numero_factura = $2, factura_error = NULL WHERE id = $1`,
    [ventaId, numeroFactura]
  );
}

/** TDSI-51/683: facturacion no pudo emitir la factura -- la venta ya quedo guardada (TDSI-179), se deja el motivo para revisar. */
async function guardarErrorFactura(ventaId, error) {
  await query(`UPDATE pagos.ventas_online SET factura_error = $2 WHERE id = $1`, [ventaId, error]);
}

/** TDSI-51/684: mismo mecanismo de token que las ventas de mostrador (TDSI-38/527), aplicado a ventas_online. */
async function obtenerTokenVerificacion(ventaId) {
  const { rows } = await query(`SELECT token_verificacion FROM pagos.ventas_online WHERE id = $1`, [ventaId]);
  return rows[0]?.token_verificacion || null;
}

async function guardarTokenVerificacion(ventaId, token) {
  await query(
    `UPDATE pagos.ventas_online SET token_verificacion = $2 WHERE id = $1 AND token_verificacion IS NULL`,
    [ventaId, token]
  );
}

/** TDSI-51/684: lo que ve el comprador al abrir el enlace "Verificar Factura" de una venta online. */
async function buscarPorTokenVerificacion(token) {
  const { rows } = await query(`SELECT * FROM pagos.ventas_online WHERE token_verificacion = $1`, [token]);
  const venta = rows[0];
  if (!venta) return null;

  const { rows: items } = await query(
    `SELECT sku, descripcion, cantidad, precio_unitario, subtotal FROM pagos.venta_online_items WHERE venta_id = $1 ORDER BY id`,
    [venta.id]
  );
  return { ...venta, total: num(venta.total), items: items.map((i) => ({ ...i, cantidad: num(i.cantidad), precio_unitario: num(i.precio_unitario), subtotal: num(i.subtotal) })) };
}

/** TDSI-51/684: resultado del aviso al Marketplace (topico "pagos-facturas-emitidas"). */
async function guardarAvisoMarketplace(ventaId, { estado, error }) {
  await query(
    `UPDATE pagos.ventas_online SET aviso_marketplace_estado = $2, aviso_marketplace_error = $3 WHERE id = $1`,
    [ventaId, estado, error || null]
  );
}

/**
 * TDSI-51/686: listado real para la pantalla "Ventas Online" del Administrador --
 * N de orden, cliente, total, metodo, N de factura, estado del aviso al Marketplace,
 * fecha, y el detalle de items de cada orden (json_agg, una sola consulta).
 */
async function listarVentas({ desde, hasta, estado } = {}) {
  const condiciones = [];
  const params = [];
  if (desde) {
    params.push(desde);
    condiciones.push(`v.recibida_en >= $${params.length}`);
  }
  if (hasta) {
    params.push(hasta);
    condiciones.push(`v.recibida_en <= $${params.length}`);
  }
  if (estado) {
    params.push(estado);
    condiciones.push(`v.estado = $${params.length}`);
  }
  const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";

  const { rows } = await query(
    `SELECT v.id, v.orden_id, v.cliente_id, v.nit, v.tipo_documento, v.razon_social,
            v.total, v.metodo_pago, v.estado, v.numero_factura, v.factura_error,
            v.aviso_marketplace_estado, v.aviso_marketplace_error, v.recibida_en,
            COALESCE(
              json_agg(
                json_build_object(
                  'sku', i.sku, 'descripcion', i.descripcion, 'cantidad', i.cantidad,
                  'precio_unitario', i.precio_unitario, 'subtotal', i.subtotal
                ) ORDER BY i.id
              ) FILTER (WHERE i.id IS NOT NULL),
              '[]'
            ) AS items
       FROM pagos.ventas_online v
       LEFT JOIN pagos.venta_online_items i ON i.venta_id = v.id
       ${where}
      GROUP BY v.id
      ORDER BY v.recibida_en DESC`,
    params
  );
  return rows.map((r) => ({
    ...r,
    total: num(r.total),
    items: r.items.map((i) => ({ ...i, cantidad: num(i.cantidad), precio_unitario: num(i.precio_unitario), subtotal: num(i.subtotal) })),
  }));
}

module.exports = {
  existeOrden,
  guardarVenta,
  registrarMensajeInvalido,
  guardarNumeroFactura,
  guardarErrorFactura,
  obtenerTokenVerificacion,
  guardarTokenVerificacion,
  buscarPorTokenVerificacion,
  guardarAvisoMarketplace,
  listarVentas,
};
