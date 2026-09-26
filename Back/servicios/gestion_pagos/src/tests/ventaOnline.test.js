const test = require("node:test");
const assert = require("node:assert/strict");
const { recibirVenta } = require("../services/ventaOnlineService");

test("TDSI-343: recibe una venta online valida (con ordenId)", async () => {
  const r = await recibirVenta({ ordenId: `ORD-TEST-${Date.now()}` });
  assert.equal(r.recibido, true);
});

test("TDSI-343: rechaza si no hay ordenId", async () => {
  await assert.rejects(() => recibirVenta({}), (e) => e.status === 400);
});

test("TDSI-343: rechaza si el body no es un objeto", async () => {
  await assert.rejects(() => recibirVenta(null), (e) => e.status === 400);
  await assert.rejects(() => recibirVenta([1, 2]), (e) => e.status === 400);
});

test("TDSI-343: rechaza una orden duplicada", async () => {
  const ordenId = `ORD-DUP-${Date.now()}`;
  await recibirVenta({ ordenId });
  await assert.rejects(() => recibirVenta({ ordenId }), (e) => e.status === 409);
});