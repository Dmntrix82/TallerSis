const test = require("node:test");
const assert = require("node:assert/strict");
const { calcularDesgloseVuelto } = require("../services/cobroEfectivoService");

test("TDSI-789: desglose para vuelto de 37.50", () => {
  const res = calcularDesgloseVuelto(37.50);
  assert.deepEqual(res, [
    { denominacion: 20, cantidad: 1 },
    { denominacion: 10, cantidad: 1 },
    { denominacion: 5, cantidad: 1 },
    { denominacion: 2, cantidad: 1 },
    { denominacion: 0.50, cantidad: 1 }
  ]);
});

test("TDSI-789: desglose para vuelto de 0.30", () => {
  const res = calcularDesgloseVuelto(0.30);
  assert.deepEqual(res, [
    { denominacion: 0.20, cantidad: 1 },
    { denominacion: 0.10, cantidad: 1 }
  ]);
});

test("TDSI-789: desglose para vuelto de 187.90", () => {
  const res = calcularDesgloseVuelto(187.90);
  assert.deepEqual(res, [
    { denominacion: 100, cantidad: 1 },
    { denominacion: 50, cantidad: 1 },
    { denominacion: 20, cantidad: 1 },
    { denominacion: 10, cantidad: 1 },
    { denominacion: 5, cantidad: 1 },
    { denominacion: 2, cantidad: 1 },
    { denominacion: 0.50, cantidad: 1 },
    { denominacion: 0.20, cantidad: 2 }
  ]);
});

test("TDSI-789: desglose para vuelto de 0", () => {
  const res = calcularDesgloseVuelto(0);
  assert.deepEqual(res, []);
});