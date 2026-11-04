// TDSI-58/773: PUT /api/metas/:cajaId, validando que la meta sea mayor a 0.
// BD real; limpia lo que crea.
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { query } = require("../config/db");
const { errorHandler } = require("../middlewares/errorHandler");

const CAJA = "CAJA-TEST-773";
let servidor, base;

test.before(async () => {
  await query(`DELETE FROM caja.metas_venta WHERE caja_id = $1`, [CAJA]);
  await query(`DELETE FROM caja.cajas WHERE codigo = $1`, [CAJA]);
  await query(`INSERT INTO caja.cajas (codigo, nombre, estado) VALUES ($1, 'Caja Test 773', 'ACTIVA')`, [CAJA]);

  const app = express();
  app.use(express.json());
  app.use("/api/metas", require("../routes/metasVentaRoutes"));
  app.use(errorHandler);
  await new Promise((ok) => { servidor = app.listen(0, ok); });
  base = `http://localhost:${servidor.address().port}/api/metas`;
});

test.after(async () => {
  servidor.close();
  await query(`DELETE FROM caja.metas_venta WHERE caja_id = $1`, [CAJA]);
  await query(`DELETE FROM caja.cajas WHERE codigo = $1`, [CAJA]);
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
