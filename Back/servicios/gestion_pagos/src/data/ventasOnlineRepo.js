const { pool } = require("../config/db");

async function existeOrden(ordenId) {
  const { rows } = await pool.query(`SELECT 1 FROM pagos.ventas_online WHERE orden_id = $1`, [ordenId]);
  return rows.length > 0;
}

async function obtenerVenta(ordenId) {
  const { rows } = await pool.query(`SELECT * FROM pagos.ventas_online WHERE orden_id = $1`, [ordenId]);
  return rows[0] || null;
}

async function guardarVenta(venta, items) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: ventaRows } = await client.query(
      `INSERT INTO pagos.ventas_online (orden_id, cliente_id, total, metodo_pago, codigo_confirmacion)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [venta.ordenId, venta.clienteId, venta.total, venta.metodoPago, venta.codigoConfirmacion]
    );
    const ventaId = ventaRows[0].id;
    for (const it of items) {
      await client.query(
        `INSERT INTO pagos.venta_online_items (venta_id, sku, descripcion, cantidad, precio_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [ventaId, it.sku, it.descripcion, it.cantidad, it.precioUnitario, it.subtotal]
      );
    }
    await client.query("COMMIT");
    return ventaId;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function marcarDespachada(ordenId) {
  const { rows } = await pool.query(
    `UPDATE pagos.ventas_online SET despachada = true WHERE orden_id = $1 RETURNING *`,
    [ordenId]
  );
  return rows[0] || null;
}

// NUEVO: Función TDSI-369 usando tu tabla exacta 'pagos.anulaciones_online'
async function guardarAnulacion({ ordenId, motivo, solicitadoPor }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    // 1. Cambiamos el estado a 'Anulado'
    await client.query(
      `UPDATE pagos.ventas_online SET estado = 'Anulado' WHERE orden_id = $1`,
      [ordenId]
    );

    // 2. Guardamos el historial en tu tabla
    const { rows } = await client.query(
      `INSERT INTO pagos.anulaciones_online (orden_id, motivo, solicitado_por)
       VALUES ($1, $2, $3) RETURNING *`,
      [ordenId, motivo, solicitadoPor || 'SISTEMA_CLIENTE']
    );

    await client.query("COMMIT");
    return rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { existeOrden, obtenerVenta, guardarVenta, marcarDespachada, guardarAnulacion };