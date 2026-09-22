const test = require("node:test");
const assert = require("node:assert/strict");
const { impresora, estadoImpresora, conmutarImpresora } = require("../services/impresoraService");

test.beforeEach(() => { impresora.conectada = true; });

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