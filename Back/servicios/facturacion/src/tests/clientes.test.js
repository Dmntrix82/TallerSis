const test = require("node:test");
const assert = require("node:assert/strict");
const { query, pool } = require("../config/db");
const { buscarClientePorNit, sugerirClientes, guardarCliente, guardarSiNoExiste } = require("../services/clientesService");

// Datos propios de esta prueba, con un sufijo unico (no depende de clientes que
// ya existan en la base real, ni los pisa -- antes este archivo asumia que
// "123456789"/"Juan Pérez" y "555555555" ya estaban cargados a mano, y esa
// suposicion se rompio cuando esos datos cambiaron en la base compartida).
const SUFIJO = String(Date.now()).slice(-8);
const NIT_EXACTO = `9${SUFIJO}`;
const NOMBRE_EXACTO = `JuanPrueba${SUFIJO}`;
const NIT_PARCIAL = `8${SUFIJO}`;
const NIT_NUEVO = `7${SUFIJO}`;
const NIT_ACTUALIZA = `6${SUFIJO}`;
const NIT_SINEXISTE = `5${SUFIJO}`;
const NITS = [NIT_EXACTO, NIT_PARCIAL, NIT_NUEVO, NIT_ACTUALIZA, NIT_SINEXISTE];

async function limpiar() {
  await query(`DELETE FROM facturacion.clientes_frecuentes WHERE nit = ANY($1)`, [NITS]);
}

test.before(async () => {
  await limpiar();
  await query(
    `INSERT INTO facturacion.clientes_frecuentes (nit, razon_social) VALUES ($1, $2), ($3, $4)`,
    [NIT_EXACTO, NOMBRE_EXACTO, NIT_PARCIAL, `Cliente Parcial ${SUFIJO}`]
  );
});

test.after(async () => {
  await limpiar();
  await pool.end();
});

test("TDSI-288: busca cliente existente por NIT exacto", async () => {
  const c = await buscarClientePorNit(NIT_EXACTO);
  assert.equal(c.nit, NIT_EXACTO);
  assert.equal(c.razon_social, NOMBRE_EXACTO);
});

test("TDSI-288: retorna 404 si el cliente no existe", async () => {
  await assert.rejects(() => buscarClientePorNit("000000000"), (e) => e.status === 404);
});

test("TDSI-288: retorna 400 si el NIT es inválido", async () => {
  await assert.rejects(() => buscarClientePorNit("abc"), (e) => e.status === 400);
});

test("TDSI-290: sugiere por nombre parcial", async () => {
  const r = await sugerirClientes(NOMBRE_EXACTO.toLowerCase());
  assert.ok(r.some((c) => c.nit === NIT_EXACTO));
});

test("TDSI-290: sugiere por NIT parcial", async () => {
  const r = await sugerirClientes(NIT_PARCIAL);
  assert.ok(r.some((c) => c.nit === NIT_PARCIAL));
});

test("TDSI-290: devuelve array vacío si query está vacío", async () => {
  assert.deepEqual(await sugerirClientes(""), []);
});

test("TDSI-289: guarda cliente nuevo", async () => {
  const c = await guardarCliente({ nit: NIT_NUEVO, razon_social: "Test SA" });
  assert.equal(c.nit, NIT_NUEVO);
});

test("TDSI-289: actualiza si ya existe (no duplica)", async () => {
  await guardarCliente({ nit: NIT_ACTUALIZA, razon_social: "Original" });
  const c2 = await guardarCliente({ nit: NIT_ACTUALIZA, razon_social: "Actualizado" });
  assert.equal(c2.razon_social, "Actualizado");
});

test("TDSI-289: guardarSiNoExiste no duplica", async () => {
  await guardarSiNoExiste({ nit: NIT_SINEXISTE, razon_social: "Primera" });
  const r2 = await guardarSiNoExiste({ nit: NIT_SINEXISTE, razon_social: "Segunda" });
  assert.equal(r2.creado, false);
  assert.equal(r2.cliente.razon_social, "Primera");
});

test("TDSI-290: sugerencias repetidas devuelven mismo resultado (cache)", async () => {
  const r1 = await sugerirClientes(NOMBRE_EXACTO.toLowerCase());
  const r2 = await sugerirClientes(NOMBRE_EXACTO.toLowerCase());
  assert.deepEqual(r1, r2);
});
