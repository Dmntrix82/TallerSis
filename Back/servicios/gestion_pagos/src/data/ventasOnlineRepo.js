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

async function guardarSolicitudAnulacion({ ordenId, motivo, solicitadoPor }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE pagos.ventas_online SET estado = 'Anulacion Pendiente' WHERE orden_id = $1`,
      [ordenId]
    );
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

async function listarSolicitudesPendientes() {
  const { rows } = await pool.query(`
    SELECT a.id, a.orden_id as "codigoTransaccion", v.cliente_id as cliente, 
           v.total as monto, a.fecha as "fechaSolicitud", a.motivo, v.estado
    FROM pagos.anulaciones_online a
    JOIN pagos.ventas_online v ON a.orden_id = v.orden_id
    WHERE v.estado = 'Anulacion Pendiente'
  `);
  return rows;
}

async function procesarAnulacion(id, nuevoEstado) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    // Obtener la anulación para saber la orden
    const { rows } = await client.query(`SELECT orden_id, motivo FROM pagos.anulaciones_online WHERE id = $1`, [id]);
    if (!rows[0]) throw new Error("Solicitud no encontrada");
    const { orden_id: ordenId, motivo } = rows[0];

    // Actualiza la venta
    const estadoVenta = nuevoEstado === 'APROBADA' ? 'Anulado' : 'Completado';
    await client.query(
      `UPDATE pagos.ventas_online SET estado = $2 WHERE orden_id = $1`,
      [ordenId, estadoVenta]
    );

    await client.query("COMMIT");
    return { ordenId, motivo };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// NUEVO: Función TDSI-370
async function marcarAnulacionNotificada(ordenId) {
  const { rows } = await pool.query(
    `UPDATE pagos.anulaciones_online SET notificado = true WHERE orden_id = $1 RETURNING *`,
    [ordenId]
  );
  return rows[0] || null;
}

module.exports = { 
  existeOrden, obtenerVenta, guardarVenta, marcarDespachada, 
  guardarSolicitudAnulacion, listarSolicitudesPendientes, procesarAnulacion,
  marcarAnulacionNotificada 
};