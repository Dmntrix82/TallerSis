const test = require("node:test");
const assert = require("node:assert/strict");
const { generarTirilla } = require("../services/tirillaService");

test("TDSI-93/295: la tirilla respeta el ancho de 40 y trae el total", async () => {
  const t = await generarTirilla("F-000001");
  assert.ok(t.lineas.every((l) => l.length <= 40));
  assert.match(t.texto, /TOTAL Bs\s+35\.00/);
});

test("TDSI-295: la tirilla incluye datos de sucursal, cliente e items", async () => {
  const t = await generarTirilla("F-000001");
  assert.match(t.texto, /Sucursal Central/);
  assert.match(t.texto, /Juan Perez/);
  assert.match(t.texto, /Arroz 1kg/);
});