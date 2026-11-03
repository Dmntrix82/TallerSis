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

module.exports = { existeOrden, guardarVenta, registrarMensajeInvalido };
