const test = require("node:test");
const assert = require("node:assert/strict");
const { recibirVenta } = require("../services/ventaOnlineService");

// Generador de un JSON de venta válido base para los tests
const basePayload = () => ({
  ordenId: `ORD-TEST-${Date.now()}-${Math.random()}`,
  clienteId: "CLI-01",
  total: 30,
  metodoPago: "QR",
  items: [{ sku: "P-1", cantidad: 3, precioUnitario: 10 }]
});

test("TDSI-343/345/346: recibe, valida y guarda una venta online en BD", async () => {
  const payload = basePayload();
  const r = await recibirVenta(payload);
  assert.equal(r.recibido, true);
  assert.match(r.codigoConfirmacion, /^CNF-/); 
});

test("TDSI-343: rechaza si no hay ordenId", async () => {
  const payload = basePayload();
  delete payload.ordenId;
  await assert.rejects(() => recibirVenta(payload), (e) => e.status === 400);
});

test("TDSI-343: rechaza si el body no es un objeto", async () => {
  await assert.rejects(() => recibirVenta(null), (e) => e.status === 400);
});

test("TDSI-343: rechaza una orden duplicada", async () => {
  const payload = basePayload();
  payload.ordenId = `ORD-DUP-${Date.now()}`;
  
  // Guardamos la primera vez en Supabase
  await recibirVenta(payload);
  
  // La segunda vez debe estallar con 409
  await assert.rejects(() => recibirVenta(payload), (e) => e.status === 409);
});

test("TDSI-344: rechaza si el total no coincide con los items", async () => {
  const payload = basePayload();
  payload.total = 50; // Trampa matemática
  await assert.rejects(() => recibirVenta(payload), (e) => e.status === 422);
});