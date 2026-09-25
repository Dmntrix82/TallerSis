const { query, withTransaction } = require("../config/db");

const num = (v) => (v === null || v === undefined ? v : Number(v));

// ---------- Pago simple / historial (TDSI-85/262/271/272) ----------

async function insertarTransaccionSimple({ id_transaccion, metodo, monto, nit, razon_social }) {
  const { rows } = await query(
    `INSERT INTO pagos.transacciones (id_transaccion, metodo, monto, tipo_pago, nit, razon_social)
     VALUES ($1, $2, $3, 'Simple', $4, $5)
     RETURNING *`,
    [id_transaccion, metodo, monto, nit || null, razon_social || null]
  );
  return { ...rows[0], monto: num(rows[0].monto) };
}

async function contarTransacciones() {
  const { rows } = await query(`SELECT COUNT(*)::int AS total FROM pagos.transacciones`);
  return rows[0].total;
}

async function listarHistorial() {
  const { rows } = await query(`SELECT * FROM pagos.transacciones ORDER BY fecha DESC`);
  return rows.map((r) => ({ ...r, monto: num(r.monto) }));
}

// ---------- Pago mixto (TDSI-87/275/276/277) ----------

async function existePagoMixto(id_transaccion) {
  const { rows } = await query(
    `SELECT 1 FROM pagos.pagos_mixtos WHERE id_transaccion = $1`,
    [id_transaccion]
  );
  return rows.length > 0;
}

/** Inserta cabecera + detalle + transacciones del pago mixto en una sola transaccion SQL. */
async function registrarPagoMixtoCompleto({ id_transaccion, cajaId, turnoId, total, metodos }) {
  return withTransaction(async (client) => {
    const { rows: pagoRows } = await client.query(
      `INSERT INTO pagos.pagos_mixtos (id_transaccion, caja_id, turno_id, total)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id_transaccion, cajaId || null, turnoId || null, total]
    );
    const pago = pagoRows[0];

    const detalle = [];
    for (const m of metodos) {
      const { rows } = await client.query(
        `INSERT INTO pagos.detalles_pago (pago_id, metodo, monto, porcentaje, referencia, orden)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [pago.id, m.metodo, m.monto, m.porcentaje, m.referencia || null, m.orden]
      );
      detalle.push(rows[0]);
    }

    const transacciones = [];
    for (const d of detalle) {
      const { rows } = await client.query(
        `INSERT INTO pagos.transacciones (id_transaccion, metodo, monto, tipo_pago, pago_mixto_id)
         VALUES ($1, $2, $3, 'Mixto', $4)
         RETURNING *`,
        [pago.id_transaccion, d.metodo, d.monto, pago.id]
      );
      transacciones.push(rows[0]);
    }

    return {
      pago: { ...pago, total: num(pago.total) },
      detalle: detalle.map((d) => ({ ...d, monto: num(d.monto), porcentaje: num(d.porcentaje) })),
      transacciones: transacciones.map((t) => ({ ...t, monto: num(t.monto) })),
    };
  });
}

async function obtenerPagoMixtoPorTransaccion(id_transaccion) {
  const { rows: pagoRows } = await query(
    `SELECT * FROM pagos.pagos_mixtos WHERE id_transaccion = $1`,
    [id_transaccion]
  );
  const pago = pagoRows[0];
  if (!pago) return null;

  const { rows: detalle } = await query(
    `SELECT * FROM pagos.detalles_pago WHERE pago_id = $1 ORDER BY orden`,
    [pago.id]
  );

  return {
    ...pago,
    total: num(pago.total),
    detalle: detalle.map((d) => ({ ...d, monto: num(d.monto), porcentaje: num(d.porcentaje) })),
  };
}

module.exports = {
  insertarTransaccionSimple,
  contarTransacciones,
  listarHistorial,
  existePagoMixto,
  registrarPagoMixtoCompleto,
  obtenerPagoMixtoPorTransaccion,
};