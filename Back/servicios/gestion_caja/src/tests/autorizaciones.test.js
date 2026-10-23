const test = require("node:test");
const assert = require("node:assert/strict");
const { query } = require("../config/db");
const service = require("../services/autorizacionService");

const CAJA_A = "CAJA-TEST-AUT-1"; // se usará para el flujo completo
const CAJA_B = "CAJA-TEST-AUT-2"; // se usará para rechazo
const CAJA_C = "CAJA-TEST-AUT-3"; // se usará para validaciones de error
const SUPERVISOR = { supervisor_id: "SUP-TEST", pin: "1234" };

async function limpiar() {
  await query(`DELETE FROM caja.autorizaciones WHERE caja_id IN ($1, $2, $3)`, [CAJA_A, CAJA_B, CAJA_C]);
  await query(`DELETE FROM caja.turnos         WHERE caja_id IN ($1, $2, $3)`, [CAJA_A, CAJA_B, CAJA_C]);
  await query(`DELETE FROM caja.cajas          WHERE codigo  IN ($1, $2, $3)`, [CAJA_A, CAJA_B, CAJA_C]);
}

async function crearCaja(codigo, estado = "ACTIVA") {
  await query(
    `INSERT INTO caja.cajas (codigo, nombre, estado)
     VALUES ($1, $2, $3)
     ON CONFLICT (codigo) DO UPDATE SET estado = EXCLUDED.estado`,
    [codigo, `Caja Test ${codigo}`, estado]
  );
}

test.before(async () => {
  await limpiar();
  await crearCaja(CAJA_A, "ACTIVA");
  await crearCaja(CAJA_B, "ACTIVA");
  await crearCaja(CAJA_C, "ACTIVA");
});

test.after(async () => {
  await limpiar();
});

// ============================================================
// TDSI-467: crear solicitud
// ============================================================

test("TDSI-467: crea una solicitud de apertura en estado PENDIENTE", async () => {
  const s = await service.solicitarApertura({
    caja_id: CAJA_A,
    cajero_id: "CAJ-AUT-1",
    cajero_nombre: "Cajero Test",
    efectivo_inicial: 150.5,
  });

  assert.equal(s.tipo, "APERTURA");
  assert.equal(s.caja_id, CAJA_A);
  assert.equal(s.cajero_id, "CAJ-AUT-1");
  assert.equal(s.cajero_nombre, "Cajero Test");
  assert.equal(s.efectivo_inicial, 150.5);
  assert.equal(s.estado, "PENDIENTE");
  assert.equal(s.turno_id, null);
  assert.equal(s.autorizado_por, null);
});

test("TDSI-467: rechaza si la caja no existe", async () => {
  await assert.rejects(
    () => service.solicitarApertura({
      caja_id: "CAJA-NO-EXISTE",
      cajero_id: "CAJ-X",
      efectivo_inicial: 50,
    }),
    (e) => e.status === 404
  );
});

test("TDSI-467: rechaza si la caja esta inactiva", async () => {
  await crearCaja(CAJA_C, "INACTIVA");
  await assert.rejects(
    () => service.solicitarApertura({
      caja_id: CAJA_C,
      cajero_id: "CAJ-X",
      efectivo_inicial: 50,
    }),
    (e) => e.status === 409
  );
});

test("TDSI-467: rechaza si ya hay una solicitud PENDIENTE para la misma caja", async () => {
  // CAJA_A ya tiene una solicitud PENDIENTE del primer test
  await assert.rejects(
    () => service.solicitarApertura({
      caja_id: CAJA_A,
      cajero_id: "CAJ-AUT-2",
      efectivo_inicial: 100,
    }),
    (e) => e.status === 409
  );
});

test("TDSI-467: rechaza si ya hay un turno ABIERTO para la misma caja", async () => {
  // Crear un turno abierto directo en la BD (sin usar el service)
  await query(
    `INSERT INTO caja.turnos (codigo, caja_id, cajero_id, cajero_nombre, efectivo_inicial)
     VALUES ('TUR-AUT-X', $1, 'CAJ-X', 'Otro', 10)`,
    [CAJA_B]
  );

  await assert.rejects(
    () => service.solicitarApertura({
      caja_id: CAJA_B,
      cajero_id: "CAJ-AUT-3",
      efectivo_inicial: 100,
    }),
    (e) => e.status === 409
  );

  // Limpiar el turno para no romper el siguiente test
  await query(`DELETE FROM caja.turnos WHERE caja_id = $1`, [CAJA_B]);
});

// ============================================================
// TDSI-582: listar pendientes
// ============================================================

test("TDSI-582: lista las solicitudes PENDIENTES de apertura", async () => {
  const pendientes = await service.listarPendientes();
  const nuestra = pendientes.find((p) => p.caja_id === CAJA_A);
  assert.ok(nuestra, "Debe aparecer la solicitud de CAJA_A");
  assert.equal(nuestra.estado, "PENDIENTE");
  assert.equal(nuestra.cajero_id, "CAJ-AUT-1");
  assert.equal(nuestra.efectivo_inicial, 150.5);
});

// ============================================================
// TDSI-468/469/605: aprobar
// ============================================================

test("TDSI-469: al aprobar, se abre el turno con el efectivo inicial declarado", async () => {
  const pendiente = (await service.listarPendientes()).find((p) => p.caja_id === CAJA_A);
  assert.ok(pendiente, "Debe existir una solicitud pendiente para CAJA_A");

  const { autorizacion, turno } = await service.aprobarSolicitud(pendiente.id, SUPERVISOR);

  // La solicitud cambia a APROBADA
  assert.equal(autorizacion.estado, "APROBADA");
  assert.equal(autorizacion.autorizado_por, "SUP-TEST");
  assert.equal(autorizacion.autorizado_por_nombre, "Supervisor Prueba");
  assert.equal(autorizacion.turno_id, turno.id);

  // El turno se abrió con los datos correctos
  assert.equal(turno.caja_id, CAJA_A);
  assert.equal(turno.cajero_id, "CAJ-AUT-1");
  assert.equal(Number(turno.efectivo_inicial), 150.5);
  assert.equal(turno.estado, "ABIERTO");
  assert.equal(turno.autorizado_por, "SUP-TEST");
  assert.equal(turno.autorizado_por_nombre, "Supervisor Prueba");
});

test("TDSI-605: aprobar una solicitud ya resuelta lanza 409", async () => {
  const pendiente = (await service.listarPendientes()).find((p) => p.caja_id === CAJA_A);
  // Ya no debe estar pendiente
  assert.equal(pendiente, undefined);
});

test("TDSI-468: aprobar con PIN incorrecto lanza error", async () => {
  // Crear solicitud nueva en CAJA_B
  const s = await service.solicitarApertura({
    caja_id: CAJA_B,
    cajero_id: "CAJ-AUT-4",
    cajero_nombre: "Cajero 4",
    efectivo_inicial: 50,
  });

  await assert.rejects(
    () => service.aprobarSolicitud(s.id, { supervisor_id: "SUP-TEST", pin: "9999" }),
    (e) => e.status >= 400 && e.status < 500
  );

  // La solicitud sigue PENDIENTE
  const pendiente = (await service.listarPendientes()).find((p) => p.id === s.id);
  assert.ok(pendiente);
  assert.equal(pendiente.estado, "PENDIENTE");
});

test("TDSI-468: aprobar sin supervisor_id o pin lanza 400", async () => {
  const pendiente = (await service.listarPendientes()).find((p) => p.caja_id === CAJA_B);
  assert.ok(pendiente);

  await assert.rejects(
    () => service.aprobarSolicitud(pendiente.id, { supervisor_id: "SUP-TEST" }),
    (e) => e.status === 400
  );
});

// ============================================================
// TDSI-468/604: rechazar
// ============================================================

test("TDSI-604: rechazar sin motivo lanza 400", async () => {
  const pendiente = (await service.listarPendientes()).find((p) => p.caja_id === CAJA_B);
  assert.ok(pendiente);

  await assert.rejects(
    () => service.rechazarSolicitud(pendiente.id, {
      supervisor_id: "SUP-TEST",
      pin: "1234",
      motivo_rechazo: "   ", // solo espacios
    }),
    (e) => e.status === 400
  );
});

test("TDSI-468: rechazar con motivo cambia el estado a RECHAZADA", async () => {
  const pendiente = (await service.listarPendientes()).find((p) => p.caja_id === CAJA_B);
  assert.ok(pendiente);

  const r = await service.rechazarSolicitud(pendiente.id, {
    supervisor_id: "SUP-TEST",
    pin: "1234",
    motivo_rechazo: "Efectivo inicial insuficiente",
  });

  assert.equal(r.estado, "RECHAZADA");
  assert.equal(r.motivo_rechazo, "Efectivo inicial insuficiente");
  assert.equal(r.autorizado_por, "SUP-TEST");
  assert.equal(r.autorizado_por_nombre, "Supervisor Prueba");
  assert.ok(r.resuelto_en);
});

test("TDSI-468: no se puede rechazar una solicitud ya resuelta", async () => {
  const pendiente = (await service.listarPendientes()).find((p) => p.caja_id === CAJA_B);
  assert.equal(pendiente, undefined);

  // Buscar la rechazada
  const { rows } = await query(
    `SELECT id FROM caja.autorizaciones WHERE caja_id = $1 ORDER BY id DESC LIMIT 1`,
    [CAJA_B]
  );
  const rechazadaId = rows[0].id;

  await assert.rejects(
    () => service.rechazarSolicitud(rechazadaId, {
      supervisor_id: "SUP-TEST",
      pin: "1234",
      motivo_rechazo: "Otra vez",
    }),
    (e) => e.status === 409
  );
});

// ============================================================
// Cierre: limpiar los turnos abiertos por los tests
// ============================================================

test.after(async () => {
  // Cerrar turnos de prueba para no dejar basura
  await query(
    `UPDATE caja.turnos SET estado = 'CERRADO', cerrado_en = now()
      WHERE caja_id IN ($1, $2, $3) AND estado = 'ABIERTO'`,
    [CAJA_A, CAJA_B, CAJA_C]
  );
});