const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buscarClientePorNit,
  sugerirClientes,
  guardarCliente,
} = require("../services/clientesService");
const { AppError } = require("../utils/AppError");

// TDSI-288: búsqueda de cliente por NIT
test("TDSI-288: busca cliente existente por NIT exacto", () => {
  const c = buscarClientePorNit("123456789");
  assert.equal(c.nit, "123456789");
  assert.equal(c.razon_social, "Juan Pérez");
  assert.equal(c.email, "juan@example.com");
});

test("TDSI-288: retorna 404 si el cliente no existe", () => {
  assert.throws(
    () => buscarClientePorNit("000000000"),
    (e) => {
      assert.ok(e instanceof AppError, "Debe ser AppError");
      assert.equal(e.status, 404);
      assert.equal(e.message, "Cliente no encontrado");
      return true;
    }
  );
});

test("TDSI-288: retorna 400 si el NIT es inválido (letras)", () => {
  assert.throws(
    () => buscarClientePorNit("abc"),
    (e) => {
      assert.equal(e.status, 400);
      return true;
    }
  );
});

test("TDSI-288: retorna 400 si el NIT está vacío", () => {
  assert.throws(() => buscarClientePorNit(""), (e) => e.status === 400);
});

test("TDSI-288: retorna 400 si el NIT tiene menos de 6 dígitos", () => {
  assert.throws(() => buscarClientePorNit("123"), (e) => e.status === 400);
});

test("TDSI-288: retorna 400 si el NIT tiene más de 15 dígitos", () => {
  assert.throws(
    () => buscarClientePorNit("1234567890123456"),
    (e) => e.status === 400
  );
});

// TDSI-290: autocompletado (sugerencias)
test("TDSI-290: sugiere por nombre parcial", () => {
  const r = sugerirClientes("juan");
  assert.equal(r.length, 1);
  assert.equal(r[0].nit, "123456789");
});

test("TDSI-290: sugiere por NIT parcial", () => {
  const r = sugerirClientes("555");
  assert.ok(r.some((c) => c.nit === "555555555"));
});

test("TDSI-290: devuelve array vacío si query está vacío", () => {
  assert.deepEqual(sugerirClientes(""), []);
  assert.deepEqual(sugerirClientes(), []);
});

test("TDSI-290: respeta el límite de resultados", () => {
  const r = sugerirClientes("a", 1);
  assert.ok(r.length <= 1);
});

// TDSI-289: guardar cliente (upsert)
test("TDSI-289: guarda cliente nuevo", () => {
  const c = guardarCliente({ nit: "222222222", razon_social: "Test SA" });
  assert.equal(c.nit, "222222222");
  assert.equal(c.razon_social, "Test SA");
});

test("TDSI-289: actualiza si ya existe (no duplica)", () => {
  guardarCliente({ nit: "333333333", razon_social: "Original" });
  const c2 = guardarCliente({ nit: "333333333", razon_social: "Actualizado" });
  assert.equal(c2.razon_social, "Actualizado");
});

test("TDSI-289: lanza 400 si falta nit o razon_social", () => {
  assert.throws(() => guardarCliente({}), (e) => e.status === 400);
  assert.throws(
    () => guardarCliente({ nit: "444444444" }),
    (e) => e.status === 400
  );
});

// TDSI-289: guardarSiNoExiste
const { guardarSiNoExiste } = require("../services/clientesService");

test("TDSI-289: crea cliente nuevo", () => {
  const r = guardarSiNoExiste({ nit: "999888777", razon_social: "Nuevo SA" });
  assert.equal(r.creado, true);
  assert.equal(r.cliente.nit, "999888777");
});

test("TDSI-289: no duplica si ya existe", () => {
  guardarSiNoExiste({ nit: "888888888", razon_social: "Primera" });
  const r2 = guardarSiNoExiste({ nit: "888888888", razon_social: "Segunda" });
  assert.equal(r2.creado, false);
  assert.equal(r2.cliente.razon_social, "Primera");
});

test("TDSI-289: no hace nada si faltan datos", () => {
  const r = guardarSiNoExiste({});
  assert.equal(r.creado, false);
  assert.equal(r.cliente, null);
});

// TDSI-290: rendimiento
test("TDSI-290: búsqueda por NIT responde en menos de 10ms", () => {
  const inicio = Date.now();
  buscarClientePorNit("123456789");
  const duracion = Date.now() - inicio;
  assert.ok(duracion < 10, `Tomó ${duracion}ms, debería ser < 10ms`);
});

test("TDSI-290: sugerencias repetidas devuelven mismo resultado (cache)", () => {
  const r1 = sugerirClientes("juan");
  const r2 = sugerirClientes("juan");
  assert.deepEqual(r1, r2);
});
