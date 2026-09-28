const { query, withTransaction } = require("../config/db");

/** TDSI-359: estado del pago (estado_pago) buscando por id_transaccion */
async function obtenerEstado(idTransaccion) {
  const { rows } = await query(
    `SELECT id, id_transaccion, estado, estado_pago, actualizado_en
       FROM pagos.transacciones
      WHERE id_transaccion = $1
      ORDER BY id
      LIMIT 1`,
    [idTransaccion]
  );
  return rows[0] || null;
}

/**
 * TDSI-360 + TDSI-361: cambia el estado_pago y registra el historial
 * en la MISMA transaccion de BD. Si validar() lanza un error, hay ROLLBACK.
 */
async function cambiarEstado(idTransaccion, estadoNuevo, validar, { motivo = null, origen = "SISTEMA" } = {}) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id, id_transaccion, estado, estado_pago
         FROM pagos.transacciones
        WHERE id_transaccion = $1
        ORDER BY id
        FOR UPDATE`,
      [idTransaccion]
    );
    const actual = rows[0] || null;
    validar(actual);

    const upd = await client.query(
      `UPDATE pagos.transacciones
          SET estado_pago = $2, actualizado_en = now()
        WHERE id = $1
        RETURNING id, id_transaccion, estado, estado_pago, actualizado_en`,
      [actual.id, estadoNuevo]
    );

    await client.query(
      `INSERT INTO pagos.historial_estados_transaccion
         (id_transaccion, estado_anterior, estado_nuevo, motivo, origen)
       VALUES ($1, $2, $3, $4, $5)`,
      [idTransaccion, actual.estado_pago, estadoNuevo, motivo, origen]
    );

    return { anterior: actual.estado_pago, transaccion: upd.rows[0] };
  });
}

/** TDSI-361: historial de cambios de una transaccion */
async function obtenerHistorial(idTransaccion) {
  const { rows } = await query(
    `SELECT estado_anterior, estado_nuevo, motivo, origen, cambiado_en
       FROM pagos.historial_estados_transaccion
      WHERE id_transaccion = $1
      ORDER BY cambiado_en DESC`,
    [idTransaccion]
  );
  return rows;
}

module.exports = { obtenerEstado, cambiarEstado, obtenerHistorial };