const test = require("node:test");
const assert = require("node:assert/strict");
const { query } = require("../config/db");
const service = require("../services/autorizacionService");

const CAJA_ID = "CAJA-TEST-CIE-1";
const SUPERVISOR = { supervisor_id: "SUP-TEST", pin: "1234" };
let turnoId;

async function limpiar() {
  await query(`DELETE FROM caja.autorizaciones WHERE caja_id = $1`, [CAJA_ID]);
  await query(`DELETE FROM caja.turnos         WHERE caja_id = $1`, [CAJA_ID]);
  await query(`DELETE FROM caja.cajas          WHERE codigo  = $1`, [CAJA_ID]);
}

test.before(async () => {
  await limpiar();
  await query(
    `INSERT INTO caja.cajas (codigo, nombre, estado) VALUES ($1, 'Caja Test Cierre', 'ACTIVA')`,
    [CAJA_ID]
  );
  const { rows } = await query(
    `INSERT INTO caja.turnos (codigo, caja_id, cajero_id, cajero_nombre, efectivo_inicial)
     VALUES ('TUR-CIE-1', $1, 'CAJ-CIE-1', 'Cajero Cierre', 100)
     RETURNING id`,
    [CAJA_ID]
  );
  turnoId = Number(rows[0].id);
});

test.after(async () => {
  await limpiar();
});

test("TDSI-471: crea solicitud de cierre con efectivo contado", async () => {
  const s = await service.solicitarCierre({
    turno_id: turnoId,
    cajero_id: "CAJ-CIE-1",
    cajero_nombre: "Cajero Cierre",
    efectivo_contado: 150.5,
  });
  assert.equal(s.tipo, "CIERRE");
  assert.equal(s.estado, "PENDIENTE");
  assert.equal(s.turno_id, turnoId);
  assert.equal(s.efectivo_contado, 150.5);
});

test("TDSI-471: rechaza si el turno no existe", async () => {
  await assert.rejects(
    () => service.solicitarCierre({ turno_id: 999999, cajero_id: "X", efectivo_contado: 50 }),
    (e) => e.status === 404
  );
});

test("TDSI-471: rechaza si el turno ya está cerrado", async () => {
  await query(`UPDATE caja.turnos SET estado = 'CERRADO' WHERE id = $1`, [turnoId]);
  await assert.rejects(
    () => service.solicitarCierre({ turno_id: turnoId, cajero_id: "X", efectivo_contado: 50 }),
    (e) => e.status === 409
  );
  await query(`UPDATE caja.turnos SET estado = 'ABIERTO' WHERE id = $1`, [turnoId]);
});

test("TDSI-471: rechaza si ya hay una solicitud pendiente para el mismo turno", async () => {
  await assert.rejects(
    () => service.solicitarCierre({ turno_id: turnoId, cajero_id: "X", efectivo_contado: 100 }),
    (e) => e.status === 409
  );
});

test("TDSI-473: al aprobar, cierra el turno", async () => {
  const pendientes = await service.listarPendientes();
  const solicitud = pendientes.find((p) => p.turno_id === turnoId && p.tipo === "CIERRE");
  assert.ok(solicitud);

  const { autorizacion, turno } = await service.aprobarSolicitud(solicitud.id, SUPERVISOR);
  assert.equal(autorizacion.estado, "APROBADA");
  assert.equal(turno.estado, "CERRADO");
  assert.equal(turno.cerrado_por, "SUP-TEST");
});

test("TDSI-472: no se puede rechazar una solicitud ya aprobada", async () => {
  const { rows } = await query(
    `SELECT id FROM caja.autorizaciones WHERE caja_id = $1 AND tipo = 'CIERRE' ORDER BY id DESC LIMIT 1`,
    [CAJA_ID]
  );
  const aprobadaId = rows[0].id;
  await assert.rejects(
    () => service.rechazarSolicitud(aprobadaId, { ...SUPERVISOR, motivo_rechazo: "X" }),
    (e) => e.status === 409
  );
});

test("TDSI-472: rechazar con motivo marca RECHAZADA y no cierra el turno", async () => {
  const { rows } = await query(
    `INSERT INTO caja.turnos (codigo, caja_id, cajero_id, cajero_nombre, efectivo_inicial)
     VALUES ('TUR-CIE-2', $1, 'CAJ-CIE-2', 'Cajero 2', 100) RETURNING id`,
    [CAJA_ID]
  );
  const nuevoTurno = rows[0].id;

  const s = await service.solicitarCierre({
    turno_id: nuevoTurno,
    cajero_id: "CAJ-CIE-2",
    cajero_nombre: "Cajero 2",
    efectivo_contado: 80,
  });

  const r = await service.rechazarSolicitud(s.id, {
    ...SUPERVISOR,
    motivo_rechazo: "Efectivo contado insuficiente",
  });

  assert.equal(r.estado, "RECHAZADA");
  assert.equal(r.motivo_rechazo, "Efectivo contado insuficiente");

  const turno = await query(`SELECT estado FROM caja.turnos WHERE id = $1`, [nuevoTurno]);
  assert.equal(turno.rows[0].estado, "ABIERTO");
});