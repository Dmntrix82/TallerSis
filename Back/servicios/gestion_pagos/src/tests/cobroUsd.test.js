const test = require("node:test");
const assert = require("node:assert/strict");
const { calcularCobroUsd } = require("../services/cobroEfectivoService");

test("TDSI-815: calcula vuelto en Bs cobrando con dólares (con decimales)", async () => {
  // 20 USD * 12 = 240 Bs. Total = 150 Bs. Vuelto = 90 Bs.
  const res = await calcularCobroUsd({ total: 150, dolaresRecibidos: 20 });
  assert.equal(res.totalBs, 150);
  assert.equal(res.tipoCambio, 12);
  assert.equal(res.equivalenteBs, 240);
  assert.equal(res.vuelto, 90);
});

test("TDSI-815: lanza error si los dólares no alcanzan (monto insuficiente)", async () => {
  // 10 USD = 120 Bs. Total = 150 Bs. Faltan 30 Bs.
  await assert.rejects(
    () => calcularCobroUsd({ total: 150, dolaresRecibidos: 10 }),
    (e) => e.status === 400 && e.message.includes("Faltan Bs 30.00")
  );
});

test("TDSI-815: calcula correctamente con centavos (ej. 10.50 USD)", async () => {
  // 10.50 USD * 12 = 126 Bs. Total = 100 Bs. Vuelto = 26 Bs.
  const res = await calcularCobroUsd({ total: 100, dolaresRecibidos: 10.50 });
  assert.equal(res.equivalenteBs, 126);
  assert.equal(res.vuelto, 26);
});