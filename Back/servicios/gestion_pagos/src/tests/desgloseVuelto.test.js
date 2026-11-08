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

// TDSI-787: en Bolivia no hay moneda menor a 0.10, asi que un vuelto con
// centavos sueltos se redondea al multiplo de 0.10 mas cercano -- el
// desglose nunca debe perder centavos en silencio.
test("TDSI-787: un vuelto con residuo menor a 0.10 se redondea hacia abajo", () => {
  const res = calcularDesgloseVuelto(10.03);
  assert.deepEqual(res, [{ denominacion: 10, cantidad: 1 }]);
});

test("TDSI-787: un vuelto con residuo menor a 0.10 se redondea hacia arriba si esta mas cerca del siguiente 0.10", () => {
  const res = calcularDesgloseVuelto(10.07);
  assert.deepEqual(res, [
    { denominacion: 10, cantidad: 1 },
    { denominacion: 0.10, cantidad: 1 },
  ]);
});

test("TDSI-787: un vuelto de solo 0.05 redondea a 0.10 (no desaparece)", () => {
  const res = calcularDesgloseVuelto(0.05);
  assert.deepEqual(res, [{ denominacion: 0.10, cantidad: 1 }]);
});

test("TDSI-787: el desglose siempre suma un multiplo de 0.10, nunca deja residuo", () => {
  for (const vuelto of [10.03, 10.07, 0.05, 0.01, 0.09, 199.94, 33.33]) {
    const d = calcularDesgloseVuelto(vuelto);
    const suma = d.reduce((acc, { denominacion, cantidad }) => acc + Math.round(denominacion * 100) * cantidad, 0);
    assert.equal(suma % 10, 0, `el desglose de ${vuelto} dejo un residuo no representable`);
  }
});