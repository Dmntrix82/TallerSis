const test = require("node:test");
const assert = require("node:assert/strict");
const { registrarPagoSimple, obtenerHistorial } = require("../services/pagoSimpleService");

test("TDSI-85/262/272: registra un pago simple", async () => {
  const r = await registrarPagoSimple({ id_transaccion: `TX-SIMPLE-${Date.now()}`, metodo: "QR", monto: 50 });
  assert.equal(r.pago.metodo, "QR");
  assert.equal(r.pago.monto, 50);
});

test("TDSI-271: rechaza un metodo invalido", async () => {
  await assert.rejects(
    () => registrarPagoSimple({ id_transaccion: "TX-X", metodo: "Cheque", monto: 10 }),
    (e) => e.status === 400
  );
});

test("TDSI-271: rechaza datos incompletos", async () => {
  await assert.rejects(
    () => registrarPagoSimple({ id_transaccion: "TX-X" }),
    (e) => e.status === 400
  );
});

test("TDSI-271: rechaza monto invalido", async () => {
  await assert.rejects(
    () => registrarPagoSimple({ id_transaccion: "TX-X", metodo: "QR", monto: -5 }),
    (e) => e.status === 400
  );
});

test("TDSI-272: el historial crece tras registrar", async () => {
  const antes = (await obtenerHistorial()).total;
  await registrarPagoSimple({ id_transaccion: `TX-SIMPLE-${Date.now()}-2`, metodo: "Efectivo", monto: 30 });
  const despues = (await obtenerHistorial()).total;
  assert.ok(despues > antes);
});