const test = require("node:test");
const assert = require("node:assert/strict");
const { impresora, estadoImpresora, conmutarImpresora, imprimir, reimprimir } = require("../services/impresoraService");
const { seed, db } = require("../data/memoria");

test.beforeEach(() => { impresora.conectada = true; seed(); });

test("TDSI-296: la impresora está conectada por defecto", () => {
  const e = estadoImpresora();
  assert.equal(e.conectada, true);
  assert.match(e.modelo, /EPSON/);
});

test("TDSI-296: se puede enviar un trabajo de impresión", () => {
  const r = impresora.enviar("hola tirilla");
  assert.match(r.jobId, /^JOB-/);
  assert.ok(r.bytes > 0);
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

test("TDSI-297: al imprimir marca la factura como impresa", () => {
  imprimir("F-000001");
  assert.equal(db.facturas[0].impresa, true);
  assert.equal(db.facturas[0].vecesImpresa, 1);
});

test("TDSI-297: no permite imprimir dos veces la misma factura", () => {
  imprimir("F-000001");
  assert.throws(() => imprimir("F-000001"), /ya fue impresa/);
});

test("TDSI-298: no permite reimprimir si nunca se imprimió antes", () => {
  assert.throws(() => reimprimir("F-000001"), /aún no fue impresa/);
});

test("TDSI-298: reimprime marcando la tirilla como copia", () => {
  imprimir("F-000001");
  const r = reimprimir("F-000001", "se dañó el papel");
  assert.equal(r.tipo, "COPIA");
  assert.equal(r.motivo, "se dañó el papel");
  assert.match(r.tirilla, /COPIA \/ REIMPRESION/);
});