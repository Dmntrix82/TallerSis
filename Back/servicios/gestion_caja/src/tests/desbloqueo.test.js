const test = require("node:test");
const assert = require("node:assert/strict");
const { query } = require("../config/db");
const sesionesRepo = require("../data/sesionesRepo");
const sesionService = require("../services/sesionCajeroService");

const CAJERO_ID = "CAJERO-TEST-DESBLOQUEO";
const EMAIL = "cajero.prueba2@tallersis.test";
const PASSWORD = "Cajero123456";
let sesionId;

async function limpiar() {
  await query(`DELETE FROM caja.sesiones_cajero WHERE cajero_id = $1`, [CAJERO_ID]);
}

test.before(async () => {
  await limpiar();
  const sesion = await sesionesRepo.insertarSesion({
    cajero_id: CAJERO_ID,
    cajero_nombre: "Cajero Test",
    caja_id: "CAJA-TEST",
  });
  sesionId = sesion.id;
});

test.after(limpiar);

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
    (e) => e.message.includes("Contraseña incorrecta")
  );
});

test("TDSI-854: cierra sesión al 3er intento fallido", async () => {
  await sesionesRepo.bloquearSesion(sesionId);
  
  // 1er intento
  await assert.rejects(
    () => sesionService.desbloquear({ cajero_id: CAJERO_ID, email: EMAIL, password: "mala" }),
    (e) => e.message.includes("Contraseña incorrecta")
  );
  
  // 2do intento
  await assert.rejects(
    () => sesionService.desbloquear({ cajero_id: CAJERO_ID, email: EMAIL, password: "mala" }),
    (e) => e.message.includes("Contraseña incorrecta")
  );
  
  // 3er intento -> cierra sesión
  await assert.rejects(
    () => sesionService.desbloquear({ cajero_id: CAJERO_ID, email: EMAIL, password: "mala" }),
    (e) => e.message.includes("Sesión cerrada")
  );

  const sesion = await sesionesRepo.obtenerSesionActiva(CAJERO_ID);
  assert.equal(sesion, null); // La sesión ya no está activa
});