const test = require("node:test");
const assert = require("node:assert/strict");
const { query } = require("../config/db");
const { impresora, estadoImpresora, conmutarImpresora, imprimir, reimprimir } = require("../services/impresoraService");
const { obtenerFactura } = require("../services/tirillaService");

// Como ahora es BD real, cada test resetea el estado de la factura de prueba.
async function resetFactura() {
  await query(`UPDATE facturacion.facturas SET impresa=false, veces_impresa=0, impresa_en=NULL WHERE numero='F-000001'`);
  await query(`DELETE FROM facturacion.impresiones WHERE factura_numero='F-000001'`);
}

test.beforeEach(async () => {
  impresora.conectada = true;
  await resetFactura();
});

test.after(async () => {
  await resetFactura();
});

test("TDSI-296: la impresora está conectada por defecto", () => {
  const e = estadoImpresora();
  assert.equal(e.conectada, true);
});

test("TDSI-296: se puede enviar un trabajo de impresión", () => {
  const r = impresora.enviar("hola tirilla");
  assert.match(r.jobId, /^JOB-/);
});

test("TDSI-296: rechaza enviar si la impresora está desconectada", () => {
  conmutarImpresora(false);
  assert.throws(() => impresora.enviar("texto"), /no conectada/);
});

test("TDSI-296: se puede reconectar la impresora", () => {
  conmutarImpresora(false);
  const e = conmutarImpresora(true);
  assert.equal(e.conectada, true);
});

test("TDSI-297: al imprimir marca la factura como impresa", async () => {
  await imprimir("F-000001");
  const f = await obtenerFactura("F-000001");
  assert.equal(f.impresa, true);
});

test("TDSI-297: no permite imprimir dos veces la misma factura", async () => {
  await imprimir("F-000001");
  await assert.rejects(() => imprimir("F-000001"), /ya fue impresa/);
});

test("TDSI-298: no permite reimprimir si nunca se imprimió antes", async () => {
  await assert.rejects(() => reimprimir("F-000001"), /aún no fue impresa/);
});

test("TDSI-298: reimprime marcando la tirilla como copia", async () => {
  await imprimir("F-000001");
  const r = await reimprimir("F-000001", "se dañó el papel");
  assert.equal(r.tipo, "COPIA");
  assert.match(r.tirilla, /COPIA \/ REIMPRESION/);
});