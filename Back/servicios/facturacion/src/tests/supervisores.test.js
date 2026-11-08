// TDSI-55/187/721/722/723/724: CRUD de "Supervisores" (usuario, PIN, activar/desactivar)
// y que un desactivado no puede autorizar con /api/supervisores/validar.
// Usa la base real; los supervisores de prueba se borran al final.
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const supervisoresRoutes = require("../routes/supervisoresRoutes");
const { errorHandler } = require("../middlewares/errorHandler");
const { pool } = require("../config/db");

const PREFIJO = `sup-test-${Date.now()}`;

let base;
let servidor;

test.before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/supervisores", supervisoresRoutes);
  app.use(errorHandler);
  await new Promise((ok) => { servidor = app.listen(0, ok); });
  base = `http://localhost:${servidor.address().port}/api/supervisores`;
});

test.after(async () => {
  servidor.close();
  await pool.query(`DELETE FROM facturacion.supervisores WHERE supervisor_id LIKE $1`, [`${PREFIJO}%`]);
  await pool.end();
});

async function llamar(metodo, ruta, body) {
  const r = await fetch(`${base}${ruta}`, {
    method: metodo,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() };
}

async function nuevoSupervisor(usuario, pin = "1234") {
  const r = await llamar("POST", "", { usuario: `${PREFIJO}-${usuario}`, nombre: `Supervisor ${usuario}`, pin });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.data;
}

const validar = (usuario, pin) => llamar("POST", "/validar", { supervisor_id: `${PREFIJO}-${usuario}`, pin });

// ---- TDSI-187: GET /api/supervisores ----

test("TDSI-187: lista usuario, nombre, estado, bloqueo y fecha de actualizacion, sin el PIN", async () => {
  await nuevoSupervisor("lista");
  const r = await llamar("GET", "");
  assert.equal(r.status, 200);
  const sup = r.body.data.find((s) => s.usuario === `${PREFIJO}-lista`);
  assert.ok(sup, "el supervisor recien creado debe aparecer en la lista");
  assert.equal(sup.estado, "Activo");
  assert.equal(sup.bloqueado, false);
  assert.ok(sup.actualizado_en);
  assert.ok(!("pin" in sup) && !("pin_hash" in sup), "la lista nunca debe traer el PIN");
});

// ---- TDSI-721: POST /api/supervisores ----

test("TDSI-721: crea un supervisor con PIN de 4 a 6 digitos, guardado con hash (no en texto plano)", async () => {
  const sup = await nuevoSupervisor("nuevo", "12345");
  assert.equal(sup.usuario, `${PREFIJO}-nuevo`);
  assert.equal(sup.estado, "Activo");

  const { rows } = await pool.query(`SELECT pin_hash FROM facturacion.supervisores WHERE supervisor_id = $1`, [`${PREFIJO}-nuevo`]);
  assert.notEqual(rows[0].pin_hash, "12345");
  assert.match(rows[0].pin_hash, /^[0-9a-f]+:[0-9a-f]+$/, "debe quedar con el formato salt:hash de hashSecret");

  assert.equal((await validar("nuevo", "12345")).status, 200);
});

test("TDSI-721: no deja repetir el usuario", async () => {
  await nuevoSupervisor("duplicado");
  const r = await llamar("POST", "", { usuario: `${PREFIJO}-duplicado`, nombre: "Otro nombre", pin: "1234" });
  assert.equal(r.status, 409);
});

test("TDSI-721: valida el PIN (4 a 6 digitos) y los campos obligatorios", async () => {
  const corto = await llamar("POST", "", { usuario: `${PREFIJO}-pin-corto`, nombre: "X", pin: "123" });
  assert.equal(corto.status, 400);
  const largo = await llamar("POST", "", { usuario: `${PREFIJO}-pin-largo`, nombre: "X", pin: "1234567" });
  assert.equal(largo.status, 400);
  const letras = await llamar("POST", "", { usuario: `${PREFIJO}-pin-letras`, nombre: "X", pin: "abcd" });
  assert.equal(letras.status, 400);
  const sinNombre = await llamar("POST", "", { usuario: `${PREFIJO}-sin-nombre`, pin: "1234" });
  assert.equal(sinNombre.status, 400);
});

// ---- TDSI-47/917: PUT /api/supervisores/:id ----

test("TDSI-917: edita el nombre y el usuario de un supervisor", async () => {
  const sup = await nuevoSupervisor("editar");
  const r = await llamar("PUT", `/${sup.id}`, { usuario: `${PREFIJO}-editado`, nombre: "Nombre Nuevo" });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.usuario, `${PREFIJO}-editado`);
  assert.equal(r.body.data.nombre, "Nombre Nuevo");

  // el usuario viejo ya no sirve para autorizar, el nuevo si (mismo PIN, no se toco)
  assert.equal((await validar("editar", "1234")).status, 401);
  const r2 = await llamar("POST", "/validar", { supervisor_id: `${PREFIJO}-editado`, pin: "1234" });
  assert.equal(r2.status, 200);
});

test("TDSI-917: no deja renombrar el usuario a uno que ya existe", async () => {
  await nuevoSupervisor("ocupado");
  const sup = await nuevoSupervisor("quiere-renombrarse");
  const r = await llamar("PUT", `/${sup.id}`, { usuario: `${PREFIJO}-ocupado`, nombre: "X" });
  assert.equal(r.status, 409);
});

test("TDSI-917: 404 si el supervisor no existe; valida campos obligatorios", async () => {
  assert.equal((await llamar("PUT", "/999999999", { usuario: "x", nombre: "y" })).status, 404);
  const sup = await nuevoSupervisor("sin-usuario");
  assert.equal((await llamar("PUT", `/${sup.id}`, { nombre: "y" })).status, 400);
  assert.equal((await llamar("PUT", `/${sup.id}`, { usuario: "x" })).status, 400);
});

test("TDSI-917: editar nombre/usuario no toca el PIN ni el estado", async () => {
  const sup = await nuevoSupervisor("conserva-pin", "7777");
  await llamar("PATCH", `/${sup.id}/estado`, { activo: false });
  const r = await llamar("PUT", `/${sup.id}`, { usuario: `${PREFIJO}-conserva-pin-2`, nombre: "Y" });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.estado, "Inactivo");
});

// ---- TDSI-722: PUT /api/supervisores/:id/pin ----

test("TDSI-722: restablecer PIN asigna uno nuevo y desbloquea al supervisor", async () => {
  const sup = await nuevoSupervisor("bloqueado", "1111");
  for (let i = 0; i < 3; i++) await validar("bloqueado", "0000"); // PIN_MAX_INTENTOS=3 por defecto
  const bloqueadoR = await validar("bloqueado", "1111");
  assert.equal(bloqueadoR.status, 423, "debe estar bloqueado tras los intentos fallidos");

  const r = await llamar("PUT", `/${sup.id}/pin`, { pin: "9999" });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.bloqueado, false);

  assert.equal((await validar("bloqueado", "1111")).status, 401, "el PIN viejo ya no debe servir");
  assert.equal((await validar("bloqueado", "9999")).status, 200, "el PIN nuevo si debe servir, sin estar bloqueado");
});

test("TDSI-722: 404 si el supervisor no existe", async () => {
  const r = await llamar("PUT", "/999999999/pin", { pin: "1234" });
  assert.equal(r.status, 404);
});

test("TDSI-722: valida el formato del PIN nuevo", async () => {
  const sup = await nuevoSupervisor("pin-invalido");
  const r = await llamar("PUT", `/${sup.id}/pin`, { pin: "12" });
  assert.equal(r.status, 400);
});

// ---- TDSI-723/724: PATCH /api/supervisores/:id/estado ----

test("TDSI-723: desactivar y reactivar cambian el estado visible en la lista", async () => {
  const sup = await nuevoSupervisor("estado");
  const d = await llamar("PATCH", `/${sup.id}/estado`, { activo: false });
  assert.equal(d.status, 200);
  assert.equal(d.body.data.estado, "Inactivo");

  const a = await llamar("PATCH", `/${sup.id}/estado`, { activo: true });
  assert.equal(a.body.data.estado, "Activo");
});

test("TDSI-723: 404 si el supervisor no existe, 400 si falta 'activo'", async () => {
  assert.equal((await llamar("PATCH", "/999999999/estado", { activo: false })).status, 404);
  const sup = await nuevoSupervisor("sin-activo");
  assert.equal((await llamar("PATCH", `/${sup.id}/estado`, {})).status, 400);
});

test("TDSI-724: un supervisor activo puede autorizar con su PIN", async () => {
  await nuevoSupervisor("activo");
  const r = await validar("activo", "1234");
  assert.equal(r.status, 200);
  assert.equal(r.body.data.supervisor_id, `${PREFIJO}-activo`);
});

test("TDSI-724: un supervisor desactivado no puede autorizar aunque el PIN sea correcto", async () => {
  const sup = await nuevoSupervisor("desactivado");
  const d = await llamar("PATCH", `/${sup.id}/estado`, { activo: false });
  assert.equal(d.status, 200);
  assert.equal(d.body.data.estado, "Inactivo");

  const r = await validar("desactivado", "1234");
  assert.equal(r.status, 401);
  assert.equal(r.body.ok, false);
  assert.equal(r.body.mensaje, "Supervisor o PIN incorrecto");
});

test("TDSI-724: el rechazo del desactivado es igual al de un usuario inexistente", async () => {
  const sup = await nuevoSupervisor("igual");
  await llamar("PATCH", `/${sup.id}/estado`, { activo: false });

  const desactivado = await validar("igual", "1234");
  const inexistente = await validar("no-existe", "1234");
  assert.equal(desactivado.status, inexistente.status);
  assert.deepEqual(desactivado.body, inexistente.body);
});

test("TDSI-724: los intentos de un desactivado no suman fallos ni lo bloquean", async () => {
  const sup = await nuevoSupervisor("sin-fallos");
  await llamar("PATCH", `/${sup.id}/estado`, { activo: false });

  for (let i = 0; i < 5; i++) {
    const r = await validar("sin-fallos", "9999");
    assert.equal(r.status, 401);
  }
  const { rows } = await pool.query(
    `SELECT intentos_fallidos, bloqueado_hasta FROM facturacion.supervisores WHERE supervisor_id = $1`,
    [`${PREFIJO}-sin-fallos`]
  );
  assert.equal(rows[0].intentos_fallidos, 0);
  assert.equal(rows[0].bloqueado_hasta, null);
});

test("TDSI-724: al volver a activarlo puede autorizar de nuevo", async () => {
  const sup = await nuevoSupervisor("reactivado");
  await llamar("PATCH", `/${sup.id}/estado`, { activo: false });
  assert.equal((await validar("reactivado", "1234")).status, 401);

  const a = await llamar("PATCH", `/${sup.id}/estado`, { activo: true });
  assert.equal(a.body.data.estado, "Activo");
  assert.equal((await validar("reactivado", "1234")).status, 200);
});

test("TDSI-724: restablecer el PIN no reactiva a un supervisor desactivado", async () => {
  const sup = await nuevoSupervisor("pin-inactivo");
  await llamar("PATCH", `/${sup.id}/estado`, { activo: false });

  const p = await llamar("PUT", `/${sup.id}/pin`, { pin: "5678" });
  assert.equal(p.status, 200);
  assert.equal(p.body.data.estado, "Inactivo");
  assert.equal((await validar("pin-inactivo", "5678")).status, 401);
});

test("TDSI-724: la lista muestra al desactivado como Inactivo y sin PIN", async () => {
  const sup = await nuevoSupervisor("lista-inactivo");
  await llamar("PATCH", `/${sup.id}/estado`, { activo: false });

  const r = await llamar("GET", "");
  assert.equal(r.status, 200);
  const fila = r.body.data.find((s) => s.usuario === `${PREFIJO}-lista-inactivo`);
  assert.equal(fila.estado, "Inactivo");
  assert.equal(fila.activo, false);
  assert.ok(!("pin" in fila) && !("pin_hash" in fila));
});
