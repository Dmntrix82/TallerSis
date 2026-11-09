const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { query } = require("../config/db");
const { errorHandler } = require("../middlewares/errorHandler");
const sesionesRepo = require("../data/sesionesRepo");
const sesionService = require("../services/sesionCajeroService");

const CAJERO_ID = "CAJERO-TEST-DESBLOQUEO";
const CAJERO_ID_HTTP = "CAJERO-TEST-DESBLOQUEO-HTTP";
const EMAIL = "cajero.prueba2@tallersis.test";
const PASSWORD = "Cajero123456";
let sesionId;
let sesionIdHttp;
let servidor, base;

async function limpiar() {
  await query(`DELETE FROM caja.sesiones_cajero WHERE cajero_id IN ($1, $2)`, [CAJERO_ID, CAJERO_ID_HTTP]);
}

test.before(async () => {
  await limpiar();
  const sesion = await sesionesRepo.insertarSesion({
    cajero_id: CAJERO_ID,
    cajero_nombre: "Cajero Test",
    caja_id: "CAJA-TEST",
  });
  sesionId = sesion.id;

  // Sesion propia para los tests HTTP, para no depender del estado en que haya
  // quedado "sesionId" despues de los tests anteriores (p.ej. ya cerrada).
  const sesionHttp = await sesionesRepo.insertarSesion({
    cajero_id: CAJERO_ID_HTTP,
    cajero_nombre: "Cajero Test HTTP",
    caja_id: "CAJA-TEST",
  });
  sesionIdHttp = sesionHttp.id;

  const app = express();
  app.use(express.json());
  app.use("/api/auth", require("../routes/authRoutes"));
  app.use(errorHandler);
  await new Promise((ok) => { servidor = app.listen(0, ok); });
  base = `http://localhost:${servidor.address().port}/api/auth`;
});

test.after(async () => {
  servidor.close();
  await limpiar();
});

test("TDSI-854: desbloqueo correcto", async () => {
  await sesionesRepo.bloquearSesion(sesionId);
  const res = await sesionService.desbloquear({
    cajero_id: CAJERO_ID,
    email: EMAIL,
    password: PASSWORD,
  });
  assert.equal(res.id, sesionId);
  assert.ok(res.desbloqueada_en);
});

test("TDSI-854: falla con contraseña incorrecta", async () => {
  await sesionesRepo.bloquearSesion(sesionId);
  await assert.rejects(
    () => sesionService.desbloquear({
      cajero_id: CAJERO_ID,
      email: EMAIL,
      password: "incorrecta",
    }),
    (e) => e.message.includes("Contraseña incorrecta") && e.status === 401
  );
});

test("TDSI-854: cierra sesión al 3er intento fallido", async () => {
  await sesionesRepo.bloquearSesion(sesionId);

  // 1er intento
  await assert.rejects(
    () => sesionService.desbloquear({ cajero_id: CAJERO_ID, email: EMAIL, password: "mala" }),
    (e) => e.message.includes("Contraseña incorrecta") && e.status === 401
  );

  // 2do intento
  await assert.rejects(
    () => sesionService.desbloquear({ cajero_id: CAJERO_ID, email: EMAIL, password: "mala" }),
    (e) => e.message.includes("Contraseña incorrecta") && e.status === 401
  );

  // 3er intento -> cierra sesión
  await assert.rejects(
    () => sesionService.desbloquear({ cajero_id: CAJERO_ID, email: EMAIL, password: "mala" }),
    (e) => e.message.includes("Sesión cerrada") && e.status === 401
  );

  const sesion = await sesionesRepo.obtenerSesionActiva(CAJERO_ID);
  assert.equal(sesion, null); // La sesión ya no está activa
});

test("TDSI-854: sin sesión activa responde 404", async () => {
  await assert.rejects(
    () => sesionService.desbloquear({ cajero_id: "CAJERO-SIN-SESION", email: EMAIL, password: PASSWORD }),
    (e) => e.status === 404
  );
});

// TDSI-183: el endpoint HTTP real tiene que devolver el status y el mensaje correctos
// (no un 500 generico) -- esto es lo que de verdad consume el Frontend.
test("TDSI-183: POST /api/auth/desbloquear responde 401 con el mensaje real ante una contraseña incorrecta", async () => {
  await sesionesRepo.bloquearSesion(sesionIdHttp);
  const r = await fetch(`${base}/desbloquear`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cajero_id: CAJERO_ID_HTTP, email: EMAIL, password: "incorrecta" }),
  });
  assert.equal(r.status, 401);
  const cuerpo = await r.json();
  assert.equal(cuerpo.ok, false);
  assert.equal(cuerpo.mensaje, "Contraseña incorrecta.");
});

test("TDSI-183: POST /api/auth/desbloquear responde 200 con una contraseña correcta", async () => {
  await sesionesRepo.bloquearSesion(sesionIdHttp);
  const r = await fetch(`${base}/desbloquear`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cajero_id: CAJERO_ID_HTTP, email: EMAIL, password: PASSWORD }),
  });
  assert.equal(r.status, 200);
  const cuerpo = await r.json();
  assert.equal(cuerpo.ok, true);
  assert.ok(cuerpo.data.desbloqueada_en);
});