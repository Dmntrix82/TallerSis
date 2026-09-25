const test = require("node:test");
const assert = require("node:assert/strict");
const { buscarClientePorNit, sugerirClientes, guardarCliente, guardarSiNoExiste } = require("../services/clientesService");

test("TDSI-288: busca cliente existente por NIT exacto", async () => {
  const c = await buscarClientePorNit("123456789");
  assert.equal(c.nit, "123456789");
  assert.equal(c.razon_social, "Juan Pérez");
});

test("TDSI-288: retorna 404 si el cliente no existe", async () => {
  await assert.rejects(() => buscarClientePorNit("000000000"), (e) => e.status === 404);
});

test("TDSI-288: retorna 400 si el NIT es inválido", async () => {
  await assert.rejects(() => buscarClientePorNit("abc"), (e) => e.status === 400);
});

test("TDSI-290: sugiere por nombre parcial", async () => {
  const r = await sugerirClientes("juan");
  assert.ok(r.some((c) => c.nit === "123456789"));
});

test("TDSI-290: sugiere por NIT parcial", async () => {
  const r = await sugerirClientes("555");
  assert.ok(r.some((c) => c.nit === "555555555"));
});

test("TDSI-290: devuelve array vacío si query está vacío", async () => {
  assert.deepEqual(await sugerirClientes(""), []);
});

test("TDSI-289: guarda cliente nuevo", async () => {
  const c = await guardarCliente({ nit: "222222222", razon_social: "Test SA" });
  assert.equal(c.nit, "222222222");
});

test("TDSI-289: actualiza si ya existe (no duplica)", async () => {
  await guardarCliente({ nit: "333333333", razon_social: "Original" });
  const c2 = await guardarCliente({ nit: "333333333", razon_social: "Actualizado" });
  assert.equal(c2.razon_social, "Actualizado");
});

test("TDSI-289: guardarSiNoExiste no duplica", async () => {
  await guardarSiNoExiste({ nit: "888888888", razon_social: "Primera" });
  const r2 = await guardarSiNoExiste({ nit: "888888888", razon_social: "Segunda" });
  assert.equal(r2.creado, false);
  assert.equal(r2.cliente.razon_social, "Primera");
});

test("TDSI-290: sugerencias repetidas devuelven mismo resultado (cache)", async () => {
  const r1 = await sugerirClientes("juan");
  const r2 = await sugerirClientes("juan");
  assert.deepEqual(r1, r2);
});