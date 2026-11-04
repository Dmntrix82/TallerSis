// TDSI-724: un supervisor desactivado no puede autorizar con /api/supervisores/validar.
// Usa un repo en memoria (no necesita base de datos) y prueba las rutas HTTP reales.
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const repo = require("../data/supervisoresRepo");
const supervisoresRoutes = require("../routes/supervisoresRoutes");
const { errorHandler } = require("../middlewares/errorHandler");

// ---- Repo en memoria con la misma interfaz que supervisoresRepo ----
const tabla = new Map(); // id -> fila
let siguienteId = 1;

const bloqueado = (f) => Boolean(f.bloqueado_hasta && new Date(f.bloqueado_hasta) > new Date());
const conBloqueo = (f) => (f ? { ...f, bloqueado: bloqueado(f) } : null);
const porUsuario = (u) => [...tabla.values()].find((f) => f.supervisor_id === u);

repo.listar = async () => [...tabla.values()].map(conBloqueo);
repo.buscar = async (u) => conBloqueo(porUsuario(u));
repo.crear = async ({ supervisor_id, nombre, pin_hash }) => {
  if (porUsuario(supervisor_id)) return null;
  const fila = {
    id: String(siguienteId++), supervisor_id, nombre, pin_hash, activo: true,
    intentos_fallidos: 0, bloqueado_hasta: null, actualizado_en: new Date(),
  };
  tabla.set(Number(fila.id), fila);
  return conBloqueo(fila);
};
repo.cambiarEstado = async (id, activo) => {
  const f = tabla.get(id);
  if (!f) return null;
  Object.assign(f, { activo, actualizado_en: new Date() });
  return conBloqueo(f);
};
repo.actualizarPin = async (id, pin_hash) => {
  const f = tabla.get(id);
  if (!f) return null;
  Object.assign(f, { pin_hash, intentos_fallidos: 0, bloqueado_hasta: null, actualizado_en: new Date() });
  return conBloqueo(f);
};
repo.registrarFallo = async (u, max, min) => {
  const f = porUsuario(u);
  if (f.intentos_fallidos + 1 >= max) {
    f.intentos_fallidos = 0;
    f.bloqueado_hasta = new Date(Date.now() + min * 60000);
  } else {
    f.intentos_fallidos += 1;
  }
  return conBloqueo(f);
};
repo.reiniciarIntentos = async (u) => {
  Object.assign(porUsuario(u), { intentos_fallidos: 0, bloqueado_hasta: null });
};

// ---- Servidor HTTP de prueba ----
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

test.after(() => servidor.close());

async function llamar(metodo, ruta, body) {
  const r = await fetch(`${base}${ruta}`, {
    method: metodo,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() };
}

async function nuevoSupervisor(usuario, pin = "1234") {
  const r = await llamar("POST", "", { usuario, nombre: `Supervisor ${usuario}`, pin });
  assert.equal(r.status, 201);
  return r.body.data;
}

const validar = (usuario, pin) => llamar("POST", "/validar", { supervisor_id: usuario, pin });

// ---- Pruebas ----
test("TDSI-724: un supervisor activo puede autorizar con su PIN", async () => {
  await nuevoSupervisor("sup-activo");
  const r = await validar("sup-activo", "1234");
  assert.equal(r.status, 200);
  assert.equal(r.body.data.supervisor_id, "sup-activo");
});

test("TDSI-724: un supervisor desactivado no puede autorizar aunque el PIN sea correcto", async () => {
  const sup = await nuevoSupervisor("sup-desactivado");
  const d = await llamar("PATCH", `/${sup.id}/estado`, { activo: false });
  assert.equal(d.status, 200);
  assert.equal(d.body.data.estado, "Inactivo");

  const r = await validar("sup-desactivado", "1234");
  assert.equal(r.status, 401);
  assert.equal(r.body.ok, false);
  assert.equal(r.body.mensaje, "Supervisor o PIN incorrecto");
});

test("TDSI-724: el rechazo del desactivado es igual al de un usuario inexistente", async () => {
  const sup = await nuevoSupervisor("sup-igual");
  await llamar("PATCH", `/${sup.id}/estado`, { activo: false });

  const desactivado = await validar("sup-igual", "1234");
  const inexistente = await validar("no-existe", "1234");
  assert.equal(desactivado.status, inexistente.status);
  assert.deepEqual(desactivado.body, inexistente.body);
});

test("TDSI-724: los intentos de un desactivado no suman fallos ni lo bloquean", async () => {
  const sup = await nuevoSupervisor("sup-sin-fallos");
  await llamar("PATCH", `/${sup.id}/estado`, { activo: false });

  for (let i = 0; i < 5; i++) {
    const r = await validar("sup-sin-fallos", "9999");
    assert.equal(r.status, 401);
  }
  const fila = tabla.get(sup.id);
  assert.equal(fila.intentos_fallidos, 0);
  assert.equal(fila.bloqueado_hasta, null);
});

test("TDSI-724: al volver a activarlo puede autorizar de nuevo", async () => {
  const sup = await nuevoSupervisor("sup-reactivado");
  await llamar("PATCH", `/${sup.id}/estado`, { activo: false });
  assert.equal((await validar("sup-reactivado", "1234")).status, 401);

  const a = await llamar("PATCH", `/${sup.id}/estado`, { activo: true });
  assert.equal(a.body.data.estado, "Activo");
  assert.equal((await validar("sup-reactivado", "1234")).status, 200);
});

test("TDSI-724: restablecer el PIN no reactiva a un supervisor desactivado", async () => {
  const sup = await nuevoSupervisor("sup-pin-inactivo");
  await llamar("PATCH", `/${sup.id}/estado`, { activo: false });

  const p = await llamar("PUT", `/${sup.id}/pin`, { pin: "5678" });
  assert.equal(p.status, 200);
  assert.equal(p.body.data.estado, "Inactivo");
  assert.equal((await validar("sup-pin-inactivo", "5678")).status, 401);
});

test("TDSI-724: la lista muestra al desactivado como Inactivo y sin PIN", async () => {
  const r = await llamar("GET", "");
  assert.equal(r.status, 200);
  const sup = r.body.data.find((s) => s.usuario === "sup-desactivado");
  assert.equal(sup.estado, "Inactivo");
  assert.equal(sup.activo, false);
  assert.ok(!("pin" in sup) && !("pin_hash" in sup));
});
