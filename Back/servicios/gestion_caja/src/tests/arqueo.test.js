// TDSI-60: arqueo de efectivo por billetes y monedas al cerrar la caja.
// BD real + gestion_pagos (GESTION_PAGOS_URL) para las ventas y facturacion
// (FACTURACION_URL) para el PIN del supervisor; limpia lo que crea.
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { query, pool } = require("../config/db");
const { calcularArqueo, compararArqueo, cerrarTurno } = require("../services/cierreService");
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

async function venderEfectivo(turnoId, monto) {
  await query(
    `INSERT INTO pagos.transacciones (id_transaccion, metodo, monto, tipo_pago, caja_id, turno_id, estado)
     VALUES ($1, 'Efectivo', $2, 'Simple', $3, $4, 'Registrado')`,
    [`VTA-ARQ-${turnoId}-${monto}`, monto, CAJA_ID, turnoId]
  );
}

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

test("TDSI-878/887: el total del arqueo se compara con el efectivo esperado (Faltante)", async () => {
  const turnoId = await crearTurno("B");
  await venderEfectivo(turnoId, 250); // esperado = 100 inicial + 250 = 350
  const r = await compararArqueo(turnoId, [{ denominacion: 100, cantidad: 3 }, { denominacion: 20, cantidad: 2 }]);
  assert.equal(r.efectivoEsperado, 350);
  assert.equal(r.efectivoContado, 340);
  assert.equal(r.tipoDiferencia, "FALTANTE");
  assert.equal(r.diferencia, -10);
  assert.deepEqual(r.denominaciones.map((d) => d.subtotal), [300, 40]);
});

test("TDSI-878: al cerrar, la diferencia del turno sale del total del arqueo", async () => {
  const turnoId = await crearTurno("C");
  await venderEfectivo(turnoId, 250);
  const r = await cerrarTurno(turnoId, {
    ...SUPERVISOR,
    arqueo: [{ denominacion: 200, cantidad: 1 }, { denominacion: 100, cantidad: 1 }, { denominacion: 50, cantidad: 1 }, { denominacion: 1, cantidad: 2 }],
  });
  assert.equal(Number(r.turno.efectivo_contado), 352);
  assert.equal(Number(r.turno.efectivo_esperado), 350);
  assert.equal(r.turno.tipo_diferencia, "SOBRANTE");
  assert.equal(r.reporte.arqueoEfectivo.diferencia, 2);
  const { rows } = await query("SELECT tipo, monto FROM caja.diferencias_resolucion WHERE turno_id = $1", [turnoId]);
  assert.deepEqual(rows.map((f) => [f.tipo, Number(f.monto)]), [["SOBRANTE", 2]]);
});

test("TDSI-878: si mandan efectivo_contado y arqueo, tienen que coincidir", async () => {
  const turnoId = await crearTurno("D");
  await assert.rejects(
    () => cerrarTurno(turnoId, { ...SUPERVISOR, efectivo_contado: 500, arqueo: [{ denominacion: 100, cantidad: 4 }] }),
    { status: 400 }
  );
  const { rows } = await query("SELECT estado FROM caja.turnos WHERE id = $1", [turnoId]);
  assert.equal(rows[0].estado, "ABIERTO");
  const r = await cerrarTurno(turnoId, { ...SUPERVISOR, efectivo_contado: "400.00", arqueo: [{ denominacion: 100, cantidad: 4 }] });
  assert.equal(Number(r.turno.efectivo_contado), 400);
});

test("TDSI-878: POST /api/caja/turnos/:id/comparar-efectivo acepta el arqueo", async () => {
  const turnoId = await crearTurno("E");
  await venderEfectivo(turnoId, 250);
  const app = express();
  app.use(express.json());
  app.use("/api/caja", require("../routes/turnosRoutes"));
  app.use(require("../middlewares/errorHandler").errorHandler);
  const servidor = await new Promise((ok) => { const s = app.listen(0, () => ok(s)); });
  try {
    const r = await fetch(`http://localhost:${servidor.address().port}/api/caja/turnos/${turnoId}/comparar-efectivo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ arqueo: [{ denominacion: 200, cantidad: 1 }, { denominacion: 50, cantidad: 3 }] }),
    });
    assert.equal(r.status, 200);
    const { data } = await r.json();
    assert.equal(data.efectivoContado, 350);
    assert.equal(data.tipoDiferencia, "CUADRA");
  } finally {
    await new Promise((ok) => servidor.close(ok));
  }
});

test("TDSI-879/888: 1.5 en una cantidad responde \"Solo números enteros\"", () => {
  assert.throws(() => calcularArqueo([{ denominacion: 100, cantidad: 1.5 }]), (e) => e.status === 400 && /Solo números enteros/.test(e.message));
  assert.throws(() => calcularArqueo([{ denominacion: 0.5, cantidad: "1.5" }]), /monedas de Bs 0.50/);
});

test("TDSI-879: rechaza cantidades negativas, texto, booleanos y numeros enormes", () => {
  for (const cantidad of [-1, "-2", "abc", "2e1", true, [], {}, 100001]) {
    assert.throws(() => calcularArqueo([{ denominacion: 10, cantidad }]), { status: 400 }, `cantidad ${JSON.stringify(cantidad)}`);
  }
});

test("TDSI-879: una cantidad vacia cuenta como 0 y \"3\" como 3", () => {
  const r = calcularArqueo([
    { denominacion: 50, cantidad: "" },
    { denominacion: 20, cantidad: null },
    { denominacion: 10, cantidad: " 3 " },
  ]);
  assert.equal(r.totalContado, 30);
  assert.deepEqual(r.filas, [{ denominacion: 10, cantidad: 3, subtotal: 30 }]);
});

test("TDSI-879: rechaza una denominacion repetida o una fila que no es objeto", () => {
  assert.throws(() => calcularArqueo([{ denominacion: 10, cantidad: 1 }, { denominacion: "10", cantidad: 2 }]), { status: 400 });
  assert.throws(() => calcularArqueo([null]), { status: 400 });
});

test("TDSI-879: con una cantidad invalida no se cierra el turno ni se guarda el arqueo", async () => {
  const turnoId = await crearTurno("F");
  await assert.rejects(() => cerrarTurno(turnoId, { ...SUPERVISOR, arqueo: [{ denominacion: 100, cantidad: 2.5 }] }), { status: 400 });
  const { rows } = await query("SELECT estado FROM caja.turnos WHERE id = $1", [turnoId]);
  assert.equal(rows[0].estado, "ABIERTO");
  assert.deepEqual(await arqueoRepo.listarPorTurno(turnoId), []);
});
