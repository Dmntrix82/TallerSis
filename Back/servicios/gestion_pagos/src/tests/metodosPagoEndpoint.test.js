// TDSI-438: pruebas HTTP de GET /api/pagos/metodos (BD real; limpia lo que crea).
// Usa dias fijos distintos a los de metodosPago.test.js (que corre en paralelo),
// para que los totales del dia no se mezclen.
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { pool } = require("../config/db");
const { errorHandler } = require("../middlewares/errorHandler");
const { registrarPagoSimple } = require("../services/pagoSimpleService");
const { registrarPagoMixto } = require("../services/pagoMixtoService");
const { hoyLocal } = require("../utils/fechaLocal");

const SUFIJO = Date.now();
const CAJERO_A = `test.metodos.ep.a.${SUFIJO}@tallersis.bo`;
const CAJERO_B = `test.metodos.ep.b.${SUFIJO}@tallersis.bo`;
const CAJA_1 = `TEST-MEP1-${SUFIJO}`;
const CAJA_2 = `TEST-MEP2-${SUFIJO}`;
const D1 = "2021-06-20";
const D2 = "2021-06-21";

let servidor;
let base;
const ops = {};

const moverA = (idTransaccion, dia, hora) =>
  pool.query(
    "UPDATE pagos.transacciones SET fecha = ($2::date + $3::time)::timestamp AT TIME ZONE 'America/La_Paz' WHERE id_transaccion = $1",
    [idTransaccion, dia, hora]
  );

test.before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/pagos/metodos", require("../routes/metodosPagoRoutes"));
  app.use("/api/pagos", require("../routes/pagosRoutes")); // igual que en index.js: metodos va antes
  app.use(errorHandler);
  await new Promise((ok) => { servidor = app.listen(0, ok); });
  base = `http://localhost:${servidor.address().port}/api/pagos`;

  const simple = async (clave, metodo, monto, cajero, caja, dia, hora) => {
    ops[clave] = (await registrarPagoSimple({ metodo, monto, caja_id: caja, cajero })).pago;
    await moverA(ops[clave].id_transaccion, dia, hora);
  };
  // Dia 1: Efectivo 40 (A, caja 1), QR 60 (B, caja 2), mixto Efectivo 30 + Tarjeta 70 (A, caja 1)
  await simple("e1", "Efectivo", 40, CAJERO_A, CAJA_1, D1, "09:00");
  await simple("q1", "QR", 60, CAJERO_B, CAJA_2, D1, "10:00");
  ops.m1 = (await registrarPagoMixto({
    cajaId: CAJA_1, cajero: CAJERO_A, total: 100,
    metodos: [{ metodo: "Efectivo", monto: 30 }, { metodo: "Tarjeta", monto: 70 }],
  })).pago;
  await moverA(ops.m1.id_transaccion, D1, "11:00");
  // Dia 2: Tarjeta 50 (B, caja 2)
  await simple("t2", "Tarjeta", 50, CAJERO_B, CAJA_2, D2, "15:00");
  // hoy: Efectivo 9 (A) para el rango por defecto
  ops.hoy = (await registrarPagoSimple({ metodo: "Efectivo", monto: 9, caja_id: CAJA_1, cajero: CAJERO_A })).pago;
});

test.after(async () => {
  await pool.query("DELETE FROM pagos.transacciones WHERE cajero_id = ANY($1)", [[CAJERO_A, CAJERO_B]]);
  await pool.query("DELETE FROM pagos.pagos_mixtos WHERE caja_id = ANY($1)", [[CAJA_1, CAJA_2]]);
  servidor.close();
  await pool.end();
});

const pedir = async (query = {}) => {
  const qs = new URLSearchParams(query).toString();
  const r = await fetch(`${base}/metodos${qs ? `?${qs}` : ""}`);
  return { status: r.status, headers: r.headers, cuerpo: await r.json() };
};

test("TDSI-438: GET /metodos devuelve los metodos del dia con monto, porcentaje y desglose", async () => {
  const { status, headers, cuerpo } = await pedir({ fecha: D1 });
  assert.equal(status, 200);
  assert.equal(cuerpo.ok, true);
  assert.equal(headers.get("cache-control"), "no-store");

  const d = cuerpo.data;
  assert.deepEqual(d.filtros, { desde: D1, hasta: D1, caja_id: null, cajero_id: null });
  assert.equal(d.cantidad_operaciones, 3);
  assert.equal(d.monto_total, 200);
  assert.deepEqual(d.metodos, [
    { metodo: "Efectivo", cantidad: 2, monto: 70, porcentaje: 35, simples: { cantidad: 1, monto: 40 }, mixtos: { cantidad: 1, monto: 30 } },
    { metodo: "Tarjeta", cantidad: 1, monto: 70, porcentaje: 35, simples: { cantidad: 0, monto: 0 }, mixtos: { cantidad: 1, monto: 70 } },
    { metodo: "QR", cantidad: 1, monto: 60, porcentaje: 30, simples: { cantidad: 1, monto: 60 }, mixtos: { cantidad: 0, monto: 0 } },
  ]);
  assert.deepEqual(d.pagos_mixtos, { cantidad: 1, monto: 100, combinaciones: [{ metodos: ["Efectivo", "Tarjeta"], cantidad: 1, monto: 100 }] });
});

test("TDSI-438: filtros por query string (rango, caja y cajero)", async () => {
  const rango = await pedir({ desde: D1, hasta: D2 });
  assert.equal(rango.cuerpo.data.monto_total, 250);
  assert.deepEqual(rango.cuerpo.data.metodos.map((m) => [m.metodo, m.monto]), [["Efectivo", 70], ["Tarjeta", 120], ["QR", 60]]);

  const caja2 = await pedir({ desde: D1, hasta: D2, caja_id: CAJA_2 });
  assert.equal(caja2.cuerpo.data.filtros.caja_id, CAJA_2);
  assert.equal(caja2.cuerpo.data.monto_total, 110);

  const cajeroA = await pedir({ fecha: D1, cajero_id: CAJERO_A });
  assert.equal(cajeroA.cuerpo.data.cantidad_operaciones, 2);
  assert.equal(cajeroA.cuerpo.data.monto_total, 140);
  assert.equal(cajeroA.cuerpo.data.pagos_mixtos.cantidad, 1);
});

test("TDSI-438: sin fechas es el dia de hoy", async () => {
  const { status, cuerpo } = await pedir({ cajero_id: CAJERO_A });
  assert.equal(status, 200);
  assert.deepEqual(cuerpo.data.filtros, { desde: hoyLocal(), hasta: hoyLocal(), caja_id: null, cajero_id: CAJERO_A });
  assert.equal(cuerpo.data.monto_total, 9);
  assert.equal(cuerpo.data.metodos[0].porcentaje, 100);
});

test("TDSI-438: 400 con mensaje si algun filtro es invalido", async () => {
  const casos = [
    { fecha: "2021-06-31" },
    { desde: D2, hasta: D1 },
    { desde: "2021-01-01", hasta: "2021-12-31" },
    { caja_id: "C".repeat(61) },
    { cajero_id: "x".repeat(61) },
  ];
  for (const q of casos) {
    const { status, cuerpo } = await pedir(q);
    assert.equal(status, 400, JSON.stringify(q));
    assert.equal(cuerpo.ok, false);
    assert.ok(cuerpo.mensaje, JSON.stringify(q));
  }
});

test("TDSI-438: no pisa las rutas existentes de /api/pagos", async () => {
  const r = await fetch(`${base}/historial`);
  assert.equal(r.status, 200);
  assert.ok(Array.isArray((await r.json()).historial));
});