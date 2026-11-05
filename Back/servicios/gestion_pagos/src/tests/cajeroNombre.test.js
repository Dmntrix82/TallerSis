// TDSI-61/199: al presionar "Cobrar" se guarda el nombre del cajero que inicio
// sesion (no solo caja_id/cajero_id, que ya existian) para poder mostrar despues
// "Atendido por" en la factura. BD real; limpia lo que crea.
const test = require("node:test");
const assert = require("node:assert/strict");
const { registrarPagoSimple } = require("../services/pagoSimpleService");
const { registrarPagoMixto } = require("../services/pagoMixtoService");
const { query } = require("../config/db");

const PREFIJO = `TX-CAJERONOMBRE-${Date.now()}`;

const idsSimpleGenerados = [];

test.after(async () => {
  await query(`DELETE FROM pagos.pagos_mixtos WHERE id_transaccion LIKE $1`, [`${PREFIJO}%`]);
  await query(`DELETE FROM pagos.transacciones WHERE id_transaccion LIKE $1`, [`${PREFIJO}%`]);
  if (idsSimpleGenerados.length) {
    await query(`DELETE FROM pagos.transacciones WHERE id_transaccion = ANY($1)`, [idsSimpleGenerados]);
  }
});

test("TDSI-199: pago simple guarda el nombre del cajero logueado", async () => {
  const r = await registrarPagoSimple({
    metodo: "QR", monto: 50,
    caja_id: "CAJA-1", turno_id: "TUR-1", cajero_id: "uuid-cajero-1", cajero_nombre: "Juana Perez",
  });
  idsSimpleGenerados.push(r.pago.id_transaccion);
  const { rows } = await query(`SELECT caja_id, cajero_nombre FROM pagos.transacciones WHERE id_transaccion = $1`, [r.pago.id_transaccion]);
  assert.equal(rows[0].caja_id, "CAJA-1");
  assert.equal(rows[0].cajero_nombre, "Juana Perez");
});

test("TDSI-199: pago simple sin nombre de cajero no rompe (queda null)", async () => {
  const r = await registrarPagoSimple({ metodo: "Efectivo", monto: 20 });
  idsSimpleGenerados.push(r.pago.id_transaccion);
  const { rows } = await query(`SELECT cajero_nombre FROM pagos.transacciones WHERE id_transaccion = $1`, [r.pago.id_transaccion]);
  assert.equal(rows[0].cajero_nombre, null);
});

test("TDSI-199: pago mixto guarda el nombre del cajero en sus transacciones", async () => {
  const id = `${PREFIJO}-MIXTO-1`;
  await registrarPagoMixto({
    id_transaccion: id, cajaId: "CAJA-2", turnoId: "TUR-2", total: 100,
    metodos: [{ metodo: "Efectivo", monto: 40 }, { metodo: "QR", monto: 60 }],
    cajeroId: "uuid-cajero-2", cajeroNombre: "Marco Soliz",
  });
  const { rows } = await query(`SELECT cajero_nombre FROM pagos.transacciones WHERE id_transaccion = $1`, [id]);
  assert.equal(rows.length, 2);
  assert.ok(rows.every((r) => r.cajero_nombre === "Marco Soliz"));
});

test("TDSI-199: pago mixto acepta cajero_nombre en snake_case tambien", async () => {
  const id = `${PREFIJO}-MIXTO-2`;
  await registrarPagoMixto({
    id_transaccion: id, cajaId: "CAJA-2", turnoId: "TUR-2", total: 100,
    metodos: [{ metodo: "Efectivo", monto: 40 }, { metodo: "QR", monto: 60 }],
    cajero_id: "uuid-cajero-3", cajero_nombre: "Rosa Mamani",
  });
  const { rows } = await query(`SELECT cajero_nombre FROM pagos.transacciones WHERE id_transaccion = $1`, [id]);
  assert.ok(rows.every((r) => r.cajero_nombre === "Rosa Mamani"));
});
