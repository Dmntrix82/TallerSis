const { query, withTransaction } = require("../config/db");

async function buscar(id) {
  const { rows } = await query(
    `SELECT id, factura_id, solicitado_por, estado
       FROM facturacion.factura_anulaciones WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function buscarFacturaPorNumero(numero) {
  const { rows } = await query(
    `SELECT id, numero, estado, bloqueada FROM facturacion.facturas WHERE numero = $1`,
    [numero]
  );
  return rows[0] || null;
}

/** TDSI-95/304/305: registra la solicitud de anulacion del cajero (motivo, quien y cuando) */
async function crear({ factura_id, motivo, solicitado_por }) {
  const { rows } = await query(
    `INSERT INTO facturacion.factura_anulaciones (factura_id, motivo, solicitado_por)
     VALUES ($1, $2, $3)
     RETURNING id, factura_id, motivo, solicitado_por, solicitado_en, estado`,
    [factura_id, motivo, solicitado_por || null]
  );
  return rows[0];
}

/**
 * TDSI-384 + TDSI-385: resuelve la anulacion en UNA transaccion.
 * Adaptado a los estados reales de la BD: 'Solicitada', 'Autorizada', 'Rechazada'.
 * El estado de facturas al aprobar es 'Anulada' (con mayuscula inicial).
 */
async function resolver(id, { aprobar, supervisor, observacion }, validar) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id, factura_id, estado FROM facturacion.factura_anulaciones
       WHERE id = $1 FOR UPDATE`,
      [id]
    );
    validar(rows[0] || null);

    if (aprobar) {
      await client.query(
        `UPDATE facturacion.facturas SET estado = 'Anulada' WHERE id = $1`,
        [rows[0].factura_id]
      );
    }

    const upd = await client.query(
      `UPDATE facturacion.factura_anulaciones
       SET estado = $2,
           autorizado_por = $3,
           autorizado_nombre = $4,
           autorizado_en = now(),
           observacion = $5
       WHERE id = $1
       RETURNING id, factura_id, estado, autorizado_por, autorizado_nombre, autorizado_en, observacion`,
      [
        id,
        aprobar ? "Autorizada" : "Rechazada",
        supervisor.supervisor_id,
        supervisor.nombre,
        observacion,
      ]
    );
    return upd.rows[0];
  });
}

module.exports = { buscar, buscarFacturaPorNumero, crear, resolver };