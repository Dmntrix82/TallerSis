const { pool } = require("../config/db");

async function existeOrden(ordenId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM pagos.ventas_online WHERE orden_id = $1`, 
    [ordenId]
  );
  return rows.length > 0;
}

async function guardarVenta(venta, items) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    // Insertamos la cabecera
    const { rows: ventaRows } = await client.query(
      `INSERT INTO pagos.ventas_online (orden_id, cliente_id, total, metodo_pago, codigo_confirmacion)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [venta.ordenId, venta.clienteId, venta.total, venta.metodoPago, venta.codigoConfirmacion]
    );
    
    const ventaId = ventaRows[0].id;

    // Insertamos el detalle de ítems
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

module.exports = { existeOrden, guardarVenta };