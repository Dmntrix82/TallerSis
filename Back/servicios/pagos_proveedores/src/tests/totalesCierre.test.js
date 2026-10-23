const test = require("node:test");
const assert = require("node:assert/strict");
const { calcularTotales } = require("../services/totalesCierreService");

test("TDSI-416: calcula impuestos (IVA 13% incluido) y neto del dia", () => {
  const r = calcularTotales({ ingresos: { total: 1500 }, egresos: { total: 300 } }, 13);
  assert.equal(r.totalIngresos, 1500);
  assert.equal(r.totalEgresos, 300);
  assert.equal(r.totalImpuestos, 195);
  assert.equal(r.totalNeto, 1005);
});

test("TDSI-416: redondea a centavos sin errores de punto flotante", () => {
  const r = calcularTotales({ ingresos: { total: 0.1 + 0.2 }, egresos: { total: 0.1 } }, 13);
  assert.equal(r.totalIngresos, 0.3);
  assert.equal(r.totalImpuestos, 0.04);
  assert.equal(r.totalNeto, 0.16);
});

test("TDSI-416: un dia sin movimientos da todo en 0", () => {
  const r = calcularTotales({ ingresos: { total: 0 }, egresos: { total: 0 } }, 13);
  assert.deepEqual(
    [r.totalIngresos, r.totalEgresos, r.totalImpuestos, r.totalNeto],
    [0, 0, 0, 0]
  );
});

test("TDSI-416: el neto puede ser negativo si los egresos superan lo vendido", () => {
  const r = calcularTotales({ ingresos: { total: 100 }, egresos: { total: 500 } }, 13);
  assert.equal(r.totalImpuestos, 13);
  assert.equal(r.totalNeto, -413);
});