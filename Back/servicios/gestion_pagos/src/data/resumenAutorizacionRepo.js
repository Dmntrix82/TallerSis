const { query } = require("../config/db");

// TDSI-59: datos de una venta para la vista previa que ve el supervisor antes de su PIN.

/** Filas de la venta (una si es pago Simple, una por metodo si es Mixto), en orden de registro. */
async function filasDeVenta(id_transaccion) {
  const { rows } = await query(
    `SELECT id_transaccion, metodo, monto, tipo_pago, nit, razon_social, tipo_documento,
            telefono, caja_id, cajero, estado, fecha
       FROM pagos.transacciones
      WHERE id_transaccion = $1
      ORDER BY id`,
    [id_transaccion]
  );
  return rows.map((r) => ({ ...r, monto: Number(r.monto) }));
}

/**
 * TDSI-903: la solicitud de anulacion pendiente de la venta (la que el cajero dejo con
 * su motivo para que la revise un supervisor). null si no hay ninguna pendiente.
 */
async function solicitudAnulacionPendiente(id_transaccion) {
  const { rows } = await query(
    `SELECT motivo, solicitado_por, solicitado_en
       FROM pagos.solicitudes_anulacion
      WHERE id_transaccion = $1 AND estado = 'Solicitada'
      ORDER BY solicitado_en DESC, id DESC
      LIMIT 1`,
    [id_transaccion]
  );
  return rows[0] || null;
}

module.exports = { filasDeVenta, solicitudAnulacionPendiente };
