const test = require("node:test");
const assert = require("node:assert/strict");
const { calcularDivision, registrarPagoMixto } = require("../services/pagoMixtoService");
const { query } = require("../config/db");

test("TDSI-87: divide con dos montos exactos", () => {
  const r = calcularDivision({ total: 250, metodos: [{ metodo: "Efectivo", monto: 100 }, { metodo: "QR", monto: 150 }] });
  assert.equal(r.cuadra, true);
});

test("TDSI-87: calcula el restante cuando falta un monto", () => {
  const r = calcularDivision({ total: 250, metodos: [{ metodo: "Efectivo", monto: 90.5 }, { metodo: "Tarjeta" }] });
  assert.equal(r.metodos[1].monto, 159.5);
});

test("TDSI-275: rechaza cuando la suma no coincide", () => {
  assert.throws(() => calcularDivision({ total: 250, metodos: [{ metodo: "Efectivo", monto: 100 }, { metodo: "QR", monto: 140 }] }), /no coincide/);
});

test("TDSI-276: guarda el detalle del pago mixto (montos y metodos)", async () => {
  const id = `TX-MIXTO-${Date.now()}`;
  const r = await registrarPagoMixto({ id_transaccion: id, cajaId: "C-1", turnoId: "T-1", total: 250, metodos: [{ metodo: "Efectivo", monto: 100 }, { metodo: "QR", monto: 150 }] });
  assert.equal(r.detalle.length, 2);
});

test("TDSI-277: registra el pago mixto en el historial de transacciones", async () => {
  const id = `TX-MIXTO-${Date.now()}-2`;
  const r = await registrarPagoMixto({ id_transaccion: id, cajaId: "C-1", turnoId: "T-1", total: 250, metodos: [{ metodo: "Efectivo", monto: 100 }, { metodo: "QR", monto: 150 }] });
  assert.equal(r.transacciones.length, 2);
  assert.equal(r.transacciones.reduce((a, t) => a + t.monto, 0), 250);
});

test.after(async () => {
  await query(`DELETE FROM pagos.pagos_mixtos WHERE id_transaccion LIKE 'TX-MIXTO-%'`);
  await query(`DELETE FROM pagos.transacciones WHERE id_transaccion LIKE 'TX-SIMPLE-%' OR id_transaccion LIKE 'TX-MIXTO-%'`);
});