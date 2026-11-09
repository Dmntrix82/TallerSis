// TDSI-62/963/964/965: apertura, cierre y aprobacion de operaciones especiales para el
// "Historial de operaciones" -- completa lo que falta de gestion_caja (las ventas y
// anulaciones de factura ya las cubre gestion_pagos, TDSI-956). BD real; limpia lo que crea.
const test = require("node:test");
const assert = require("node:assert/strict");
const { query } = require("../config/db");
const { listarEventos } = require("../services/eventosAutorizacionService");
const { registrar } = require("../services/operacionEspecialService");
const { hoyLocal } = require("../utils/fechas");

const CAJA = "CAJA-TEST-EVT62";
const SUPERVISOR = { supervisor_id: "SUP-TEST", pin: "1234" };
let turnoId;

test.before(async () => {
  await query(`DELETE FROM caja.aprobaciones_especiales WHERE caja_id = $1`, [CAJA]);
  await query(`DELETE FROM caja.turnos WHERE caja_id = $1`, [CAJA]);
  await query(`DELETE FROM caja.cajas WHERE codigo = $1`, [CAJA]);
  await query(`INSERT INTO caja.cajas (codigo, nombre, estado) VALUES ($1, 'Caja Test Eventos 62', 'ACTIVA')`, [CAJA]);

  const { rows } = await query(
    `INSERT INTO caja.turnos (codigo, caja_id, cajero_id, cajero_nombre, efectivo_inicial, autorizado_por, autorizado_por_nombre)
     VALUES ('TURNO-TEST-EVT62', $1, 'cajero-evt62@test.com', 'Cajero Evt62', 100, $2, 'Supervisor Prueba')
     RETURNING id`,
    [CAJA, SUPERVISOR.supervisor_id]
  );
  turnoId = rows[0].id;

  await registrar({
    turno_id: turnoId, tipo: "RETIRO_EFECTIVO", descripcion: "Retiro para cambio", monto: 20,
    cajero_id: "cajero-evt62@test.com", cajero_nombre: "Cajero Evt62",
    ...SUPERVISOR,
  });

  await query(
    `UPDATE caja.turnos SET estado = 'CERRADO', cerrado_en = now(), cerrado_por = $2, cerrado_por_nombre = 'Supervisor Prueba'
      WHERE id = $1`,
    [turnoId, SUPERVISOR.supervisor_id]
  );
});

test.after(async () => {
  await query(`DELETE FROM caja.aprobaciones_especiales WHERE caja_id = $1`, [CAJA]);
  await query(`DELETE FROM caja.turnos WHERE caja_id = $1`, [CAJA]);
  await query(`DELETE FROM caja.cajas WHERE codigo = $1`, [CAJA]);
});

test("TDSI-963: la apertura y el cierre del turno aparecen con quien pidio y que supervisor autorizo", async () => {
  const hoy = hoyLocal();
  const { eventos } = await listarEventos({ desde: hoy, hasta: hoy });

  const apertura = eventos.find((e) => e.tipo === "APERTURA" && e.caja_id === CAJA);
  const cierre = eventos.find((e) => e.tipo === "CIERRE" && e.caja_id === CAJA);

  assert.ok(apertura, "la apertura debe aparecer en el historial");
  assert.equal(apertura.pedido_por, "cajero-evt62@test.com");
  assert.equal(apertura.autorizado_por, "Supervisor Prueba");

  assert.ok(cierre, "el cierre debe aparecer en el historial");
  assert.equal(cierre.pedido_por, "cajero-evt62@test.com");
  assert.equal(cierre.autorizado_por, "Supervisor Prueba");
});

test("TDSI-964/965: la operacion especial aparece con su monto y descripcion, y el filtro por supervisor la trae", async () => {
  const hoy = hoyLocal();
  const { eventos } = await listarEventos({ desde: hoy, hasta: hoy, supervisor_id: "SUP-TEST" });

  const aprobacion = eventos.find((e) => e.tipo === "OPERACION_ESPECIAL" && e.caja_id === CAJA);
  assert.ok(aprobacion, "la operacion especial debe aparecer");
  assert.equal(aprobacion.pedido_por, "cajero-evt62@test.com");
  assert.equal(aprobacion.autorizado_por, "Supervisor Prueba");
  assert.equal(aprobacion.monto, 20);
  assert.equal(aprobacion.descripcion, "Retiro para cambio");

  assert.ok(eventos.every((e) => e.caja_id !== CAJA || e.autorizado_por === "Supervisor Prueba"));
});

test("TDSI-965: un supervisor sin eventos en el rango no trae nada", async () => {
  const hoy = hoyLocal();
  const { eventos } = await listarEventos({ desde: hoy, hasta: hoy, supervisor_id: "SUP-NO-EXISTE" });
  assert.ok(!eventos.some((e) => e.caja_id === CAJA));
});

test("valida el rango de fechas igual que el resto de reportes", async () => {
  await assert.rejects(() => listarEventos({ desde: "2099-01-05", hasta: "2099-01-01" }), { status: 400 });
  await assert.rejects(() => listarEventos({ desde: "fecha-invalida" }), { status: 400 });
});
