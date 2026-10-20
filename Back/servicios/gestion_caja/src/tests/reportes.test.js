// TDSI-36: reporte de operaciones de caja (JSON y CSV). BD real + gestion_pagos (GESTION_PAGOS_URL)
// para las ventas y facturacion (FACTURACION_URL) para el PIN; limpia lo que crea.
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { query } = require("../config/db");
const { errorHandler } = require("../middlewares/errorHandler");
const { cerrarTurno } = require("../services/cierreService");
const { generarReporte, reporteACsv } = require("../services/reporteCajaService");
const { hoyLocal } = require("../utils/fechas");

const CAJA = "CAJA-TEST-REP-1";
const SUPERVISOR = { supervisor_id: "SUP-TEST", pin: "1234" };
const HOY = hoyLocal();
// Dia fijo: el test no depende de la hora en que se corra (ej. pasada la medianoche).
const DIA = "2021-04-15";
const en = (hora) => `${DIA} ${hora}-04`;
let t1, t2;
let servidor, base;

async function limpiar() {
  await query(`DELETE FROM pagos.transacciones WHERE id_transaccion LIKE 'REP36-%'`);
  await query(`DELETE FROM caja.turnos WHERE caja_id = $1`, [CAJA]);
  await query(`DELETE FROM caja.cajas WHERE codigo = $1`, [CAJA]);
}

async function turno(codigo, inicial, abierto) {
  const { rows } = await query(
    `INSERT INTO caja.turnos (codigo, caja_id, cajero_id, cajero_nombre, efectivo_inicial, abierto_en)
     VALUES ($1, $2, 'CAJ-REP', 'Cajero Reporte', $3, $4) RETURNING id`,
    [codigo, CAJA, inicial, en(abierto)]
  );
  return Number(rows[0].id);
}

async function venta(id, metodo, monto, hora, estado = "Registrado") {
  await query(
    `INSERT INTO pagos.transacciones (id_transaccion, metodo, monto, tipo_pago, caja_id, estado, fecha)
     VALUES ($1, $2, $3, 'Simple', $4, $5, $6)`,
    [id, metodo, monto, CAJA, estado, en(hora)]
  );
}

test.before(async () => {
  await limpiar();
  await query(`INSERT INTO caja.cajas (codigo, nombre, estado) VALUES ($1, 'Caja Test Reportes', 'ACTIVA')`, [CAJA]);

  // Turno 1 (08:00-12:00): inicial 100, ventas Efectivo 40 + QR 60; se cuentan 135 -> FALTANTE -5
  t1 = await turno("TUR-REP-1", 100, "08:00");
  await venta("REP36-1", "Efectivo", 40, "09:00");
  await venta("REP36-2", "QR", 60, "10:00");
  await cerrarTurno(t1, { ...SUPERVISOR, efectivo_contado: 135 });
  await query(`UPDATE caja.turnos SET cerrado_en = $2 WHERE id = $1`, [t1, en("12:00")]);

  // Turno 2 (14:00-18:00): inicial 50, venta Tarjeta 80 y una anulada en efectivo de 30; se cuentan 50 -> CUADRA
  t2 = await turno("TUR-REP-2", 50, "14:00");
  await venta("REP36-3", "Tarjeta", 80, "15:00");
  await venta("REP36-4", "Efectivo", 30, "16:00", "Anulado");
  await cerrarTurno(t2, { ...SUPERVISOR, efectivo_contado: 50 });
  await query(`UPDATE caja.turnos SET cerrado_en = $2 WHERE id = $1`, [t2, en("18:00")]);

  // Turno de otro dia: no entra en el reporte del 15
  await query(
    `INSERT INTO caja.turnos (codigo, caja_id, cajero_id, efectivo_inicial, estado, abierto_en, cerrado_en)
     VALUES ('TUR-REP-OLD', $1, 'CAJ-REP', 10, 'CERRADO', '2021-03-01 10:00-04', '2021-03-01 18:00-04')`,
    [CAJA]
  );

  const app = express();
  app.use(express.json());
  app.use("/api/caja/reportes", require("../routes/reportesRoutes"));
  app.use(errorHandler);
  await new Promise((ok) => { servidor = app.listen(0, ok); });
  base = `http://localhost:${servidor.address().port}/api/caja/reportes`;
});

test.after(async () => {
  servidor.close();
  await limpiar();
});

test("TDSI-491/492: reporte del dia con totales por metodo, turnos y diferencias", async () => {
  const r = await generarReporte({ caja_id: CAJA, desde: DIA, hasta: DIA });
  assert.equal(r.caja_nombre, "Caja Test Reportes");
  assert.deepEqual([r.desde, r.hasta], [DIA, DIA]);

  assert.deepEqual(r.resumen, {
    turnos: 2,
    total_recaudado: 180,
    ventas: 3,
    anuladas: 1,
    monto_anulado: 30,
    diferencias: 1,
    diferencias_pendientes: 1,
    total_faltantes: -5,
    total_sobrantes: 0,
  });
  assert.deepEqual(r.totales_por_metodo, [
    { metodo: "Efectivo", monto: 40, operaciones: 1 },
    { metodo: "Tarjeta", monto: 80, operaciones: 1 },
    { metodo: "QR", monto: 60, operaciones: 1 },
  ]);

  assert.deepEqual(r.turnos.map((t) => [t.codigo, t.total_recaudado, t.efectivo_esperado, t.efectivo_contado, t.diferencia, t.tipo_diferencia]), [
    ["TUR-REP-1", 100, 140, 135, -5, "FALTANTE"],
    ["TUR-REP-2", 80, 50, 50, 0, "CUADRA"],
  ]);
  assert.deepEqual(r.turnos[1].por_metodo, { Efectivo: 0, Tarjeta: 80, QR: 0 });
  assert.deepEqual(r.diferencias.map((d) => [d.turno_codigo, d.tipo, d.monto, d.estado]), [["TUR-REP-1", "FALTANTE", -5, "PENDIENTE"]]);
});

test("TDSI-491: el rango filtra por dia (hora de Bolivia) y por defecto es hoy", async () => {
  const hoy = await generarReporte({ caja_id: CAJA });
  assert.deepEqual([hoy.desde, hoy.hasta], [HOY, HOY]);
  assert.equal(hoy.resumen.turnos, 0);

  const semana = await generarReporte({ caja_id: CAJA, desde: "2021-04-10", hasta: "2021-04-16" });
  assert.equal(semana.resumen.turnos, 2);
  assert.equal(semana.resumen.total_recaudado, 180);

  const viejo = await generarReporte({ caja_id: CAJA, desde: "2021-03-01", hasta: "2021-03-01" });
  assert.deepEqual(viejo.turnos.map((t) => t.codigo), ["TUR-REP-OLD"]);
  assert.equal(viejo.resumen.total_recaudado, 0);

  const vacio = await generarReporte({ caja_id: CAJA, desde: "2021-01-01", hasta: "2021-01-31" });
  assert.equal(vacio.resumen.turnos, 0);
  assert.deepEqual(vacio.totales_por_metodo.map((m) => m.monto), [0, 0, 0]);
});

test("TDSI-491: valida caja, fechas y rango", async () => {
  const casos = [
    [{}, 400],
    [{ caja_id: CAJA, desde: "2026-02-30" }, 400],
    [{ caja_id: CAJA, desde: "2026-10-10", hasta: "2026-10-01" }, 400],
    [{ caja_id: CAJA, desde: "2026-01-01", hasta: "2026-12-31" }, 400],
    [{ caja_id: "CAJA-NO-EXISTE" }, 404],
  ];
  for (const [f, status] of casos) {
    await assert.rejects(() => generarReporte(f), (e) => e.status === status, JSON.stringify(f));
  }
});

test("TDSI-493: el CSV trae resumen, metodos, turnos y diferencias", async () => {
  const csv = reporteACsv(await generarReporte({ caja_id: CAJA, desde: DIA, hasta: DIA }));
  assert.ok(csv.startsWith("﻿"));
  const lineas = csv.split("\r\n");
  assert.ok(lineas.includes("2,180.00,3,1,30.00,1,1,-5.00,0.00"));
  assert.ok(lineas.includes("Efectivo,40.00,1"));
  assert.ok(lineas.includes("QR,60.00,1"));
  assert.ok(lineas.some((l) => l.startsWith("TUR-REP-1,Cajero Reporte,CERRADO,") && l.endsWith(",100.00,140.00,135.00,-5.00,FALTANTE")));
  assert.ok(lineas.some((l) => l.startsWith("TUR-REP-1,FALTANTE,-5.00,PENDIENTE")));
});

test("TDSI-494: GET /api/caja/reportes en JSON y CSV", async () => {
  const json = await fetch(`${base}?caja_id=${CAJA}&desde=${DIA}&hasta=${DIA}`);
  assert.equal(json.status, 200);
  const cuerpo = await json.json();
  assert.equal(cuerpo.ok, true);
  assert.equal(cuerpo.data.resumen.total_recaudado, 180);

  const csv = await fetch(`${base}?caja_id=${CAJA}&desde=${DIA}&hasta=${DIA}&formato=CSV`);
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get("content-type"), /text\/csv/);
  assert.equal(csv.headers.get("content-disposition"), `attachment; filename="reporte-${CAJA}-${DIA}-a-${DIA}.csv"`);
  assert.match(await csv.text(), /TOTALES POR METODO/);

  for (const [q, status] of [["", 400], [`?caja_id=${CAJA}&formato=pdf`, 400], ["?caja_id=CAJA-NO-EXISTE", 404]]) {
    const r = await fetch(`${base}${q}`);
    assert.equal(r.status, status, q);
    assert.equal((await r.json()).ok, false);
  }
});
