// TDSI-60: arqueo de efectivo por billetes y monedas al cerrar la caja.
// BD real + gestion_pagos (GESTION_PAGOS_URL) para las ventas y facturacion
// (FACTURACION_URL) para el PIN del supervisor; limpia lo que crea.
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { query, pool } = require("../config/db");
const { calcularArqueo, cerrarTurno } = require("../services/cierreService");
const arqueoRepo = require("../data/arqueoRepo");

const SUFIJO = Date.now();
const CAJA_ID = `CAJA-ARQ-${SUFIJO}`.slice(0, 20);
const SUPERVISOR = { supervisor_id: "SUP-TEST", pin: "1234" };
const turnos = [];

/** Turno abierto con 100 de efectivo inicial y 250 vendidos en efectivo (esperado 350). */
async function crearTurno(sufijo) {
  const { rows } = await query(
    `INSERT INTO caja.turnos (codigo, caja_id, cajero_id, cajero_nombre, efectivo_inicial)
     VALUES ($1, $2, 'U-ARQ', 'Cajero Arqueo', 100) RETURNING id`,
    [`T-ARQ-${sufijo}-${SUFIJO}`.slice(0, 20), CAJA_ID]
  );
  turnos.push(rows[0].id);
  return rows[0].id;
}

test.before(async () => {
  await query(
    `INSERT INTO caja.cajas (codigo, nombre, estado) VALUES ($1, 'Caja Arqueo', 'ACTIVA')
     ON CONFLICT (codigo) DO NOTHING`,
    [CAJA_ID]
  );
});

test.after(async () => {
  await query("DELETE FROM pagos.transacciones WHERE caja_id = $1", [CAJA_ID]);
  await query("DELETE FROM caja.diferencias_resolucion WHERE turno_id = ANY($1)", [turnos]);
  await query("DELETE FROM caja.turnos WHERE id = ANY($1)", [turnos]);
  await query("DELETE FROM caja.cajas WHERE codigo = $1", [CAJA_ID]);
  await pool.end();
});

test("TDSI-877/886: 3 billetes de 100 y 2 de 50 suman Bs 400.00", () => {
  const r = calcularArqueo([
    { denominacion: 50, cantidad: 2 },
    { denominacion: 100, cantidad: 3 },
    { denominacion: 20, cantidad: 0 },
  ]);
  assert.equal(r.totalContado, 400);
  assert.deepEqual(r.filas, [
    { denominacion: 100, cantidad: 3, subtotal: 300 },
    { denominacion: 50, cantidad: 2, subtotal: 100 },
  ]);
});

test("TDSI-877: las monedas de 0.10, 0.20 y 0.50 se suman sin errores de redondeo", () => {
  const r = calcularArqueo([
    { denominacion: 0.1, cantidad: 3 },
    { denominacion: 0.2, cantidad: 1 },
    { denominacion: 0.5, cantidad: 1 },
  ]);
  assert.equal(r.totalContado, 1);
});

test("TDSI-877: rechaza una denominacion que no es billete ni moneda de Bs", () => {
  assert.throws(() => calcularArqueo([{ denominacion: 3, cantidad: 1 }]), { status: 400 });
  assert.throws(() => calcularArqueo([]), { status: 400 });
});

test("TDSI-877: al cerrar con el arqueo se guarda el detalle y se devuelve el total contado", async () => {
  const turnoId = await crearTurno("A");
  const r = await cerrarTurno(turnoId, {
    ...SUPERVISOR,
    arqueo: [{ denominacion: 200, cantidad: 1 }, { denominacion: 20, cantidad: 2 }, { denominacion: 0.5, cantidad: 2 }],
  });
  assert.equal(r.turno.estado, "CERRADO");
  assert.equal(r.arqueoDenominaciones.totalContado, 241);
  assert.deepEqual(await arqueoRepo.listarPorTurno(turnoId), [
    { denominacion: 200, cantidad: 1, subtotal: 200 },
    { denominacion: 20, cantidad: 2, subtotal: 40 },
    { denominacion: 0.5, cantidad: 2, subtotal: 1 },
  ]);
});

test("TDSI-60/885: GET /api/caja/arqueo/denominaciones lista los 5 billetes y las 6 monedas", async () => {
  const app = express();
  app.use("/api/caja", require("../routes/turnosRoutes"));
  const servidor = await new Promise((ok) => { const s = app.listen(0, () => ok(s)); });
  try {
    const r = await fetch(`http://localhost:${servidor.address().port}/api/caja/arqueo/denominaciones`);
    const { data } = await r.json();
    assert.deepEqual(data.map((d) => d.valor), [200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1]);
    assert.equal(data.filter((d) => d.tipo === "BILLETE").length, 5);
  } finally {
    await new Promise((ok) => servidor.close(ok));
  }
});
