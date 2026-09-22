const test = require("node:test");
const assert = require("node:assert/strict");
const { generarTirilla } = require("../services/tirillaService");

test("TDSI-93/295: la tirilla respeta el ancho de 40 y trae el total", () => {
  const t = generarTirilla("F-000001");
  assert.ok(t.lineas.every((l) => l.length <= 40));
  assert.match(t.texto, /TOTAL Bs\s+35\.00/);
});