// TDSI-58/773/774: PUT /api/metas/:cajaId (valida que la meta sea mayor a 0) y
// GET /api/metas?fecha= (meta, vendido y % de avance, reutilizando recaudadoService).
// BD real + gestion_pagos (GESTION_PAGOS_URL); limpia lo que crea.
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { query } = require("../config/db");
const { errorHandler } = require("../middlewares/errorHandler");

const CAJA = "CAJA-TEST-773";
const CAJA2 = "CAJA-TEST-774";
const DIA = "2021-09-05";
const en = (hora) => `${DIA} ${hora}-04`;
let servidor, base;

test.before(async () => {
  await query(`DELETE FROM caja.metas_venta WHERE caja_id = ANY($1)`, [[CAJA, CAJA2]]);
  await query(`DELETE FROM pagos.transacciones WHERE caja_id = $1`, [CAJA2]);
  await query(`DELETE FROM caja.cajas WHERE codigo = ANY($1)`, [[CAJA, CAJA2]]);
  await query(`INSERT INTO caja.cajas (codigo, nombre, estado) VALUES ($1, 'Caja Test 773', 'ACTIVA')`, [CAJA]);
  await query(`INSERT INTO caja.cajas (codigo, nombre, estado) VALUES ($1, 'Caja Test 774', 'ACTIVA')`, [CAJA2]);
  await query(
    `INSERT INTO pagos.transacciones (id_transaccion, metodo, monto, tipo_pago, caja_id, estado, fecha)
     VALUES ('META774-1', 'Efectivo', 300, 'Simple', $1, 'Registrado', $2)`,
    [CAJA2, en("10:00")]
  );

  const app = express();
  app.use(express.json());
  app.use("/api/metas", require("../routes/metasVentaRoutes"));
  app.use(errorHandler);
  await new Promise((ok) => { servidor = app.listen(0, ok); });
  base = `http://localhost:${servidor.address().port}/api/metas`;
});

test.after(async () => {
  servidor.close();
  await query(`DELETE FROM caja.metas_venta WHERE caja_id = ANY($1)`, [[CAJA, CAJA2]]);
  await query(`DELETE FROM pagos.transacciones WHERE caja_id = $1`, [CAJA2]);
  await query(`DELETE FROM caja.cajas WHERE codigo = ANY($1)`, [[CAJA, CAJA2]]);
});

async function fijarMeta(monto, actualizado_por) {
  const r = await fetch(`${base}/${CAJA}`, {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ monto, actualizado_por }),
  });
  return { status: r.status, body: await r.json() };
}

test("TDSI-773: fija la meta de una caja", async () => {
  const r = await fijarMeta(500, "admin1");
  assert.equal(r.status, 200);
  assert.equal(r.body.data.caja_id, CAJA);
  assert.equal(r.body.data.monto_meta, 500);
  assert.equal(r.body.data.actualizado_por, "admin1");
  assert.ok(r.body.data.actualizado_en);

  const { rows } = await query(`SELECT monto_meta, actualizado_por FROM caja.metas_venta WHERE caja_id = $1`, [CAJA]);
  assert.equal(Number(rows[0].monto_meta), 500);
  assert.equal(rows[0].actualizado_por, "admin1");
});

test("TDSI-773: 'Editar meta' actualiza la misma fila, no crea otra", async () => {
  await fijarMeta(500, "admin1");
  const r = await fijarMeta(800, "admin2");
  assert.equal(r.status, 200);
  assert.equal(r.body.data.monto_meta, 800);
  assert.equal(r.body.data.actualizado_por, "admin2");

  const { rows } = await query(`SELECT COUNT(*)::int AS n FROM caja.metas_venta WHERE caja_id = $1`, [CAJA]);
  assert.equal(rows[0].n, 1);
});

test("TDSI-773: rechaza una meta en 0 o negativa", async () => {
  const cero = await fijarMeta(0, "admin1");
  assert.equal(cero.status, 400);

  const negativa = await fijarMeta(-10, "admin1");
  assert.equal(negativa.status, 400);
});

test("TDSI-773: rechaza si falta el monto", async () => {
  const r = await fijarMeta(undefined, "admin1");
  assert.equal(r.status, 400);
});

test("TDSI-773: 404 si la caja no existe", async () => {
  const r = await fetch(`${base}/CAJA-NO-EXISTE-773`, {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ monto: 500 }),
  });
  assert.equal(r.status, 404);
});

test("TDSI-774/775: sin meta cargada, vendido sale igual pero meta/porcentaje devuelven 'sin meta'", async () => {
  const r = await fetch(`${base}?fecha=${DIA}`);
  assert.equal(r.status, 200);
  const cuerpo = await r.json();
  const fila = cuerpo.data.find((c) => c.caja_id === CAJA2);
  assert.ok(fila, "la caja de prueba debe aparecer en el listado");
  assert.equal(fila.vendido, 300);
  assert.equal(fila.meta, "sin meta");
  assert.equal(fila.porcentaje, "sin meta");
});

test("TDSI-774: con meta cargada, calcula el % de avance (vendido/meta*100)", async () => {
  await fetch(`${base}/${CAJA2}`, {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ monto: 500, actualizado_por: "admin1" }),
  });

  const r = await fetch(`${base}?fecha=${DIA}`);
  const cuerpo = await r.json();
  const fila = cuerpo.data.find((c) => c.caja_id === CAJA2);
  assert.equal(fila.vendido, 300);
  assert.equal(fila.meta, 500);
  assert.equal(fila.porcentaje, 60); // 300/500*100
});

test("TDSI-774: sin fecha, usa el dia de hoy (reutiliza el default de recaudadoService)", async () => {
  const r = await fetch(`${base}`);
  assert.equal(r.status, 200);
  const cuerpo = await r.json();
  assert.ok(Array.isArray(cuerpo.data));
});
