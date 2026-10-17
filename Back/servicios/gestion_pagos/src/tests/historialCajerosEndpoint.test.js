// TDSI-434: pruebas HTTP de GET /api/pagos/historial-cajeros (BD real; limpia lo que crea).
// Usa dias fijos distintos a los de historialCajeros.test.js (que corre en paralelo),
// para que los conteos de "todos los cajeros" no se mezclen.
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { pool } = require("../config/db");
const { errorHandler } = require("../middlewares/errorHandler");
const { registrarPagoSimple } = require("../services/pagoSimpleService");
const { registrarPagoMixto } = require("../services/pagoMixtoService");
const { marcarRevision } = require("../services/revisionService");
const { hoyLocal } = require("../utils/fechaLocal");

const SUFIJO = Date.now();
const CAJERO_A = `test.hist.ep.a.${SUFIJO}@tallersis.bo`;
const CAJERO_B = `test.hist.ep.b.${SUFIJO}@tallersis.bo`;
const CAJA_1 = `TEST-HEP1-${SUFIJO}`;
const CAJA_2 = `TEST-HEP2-${SUFIJO}`;
const D1 = "2021-04-10";
const D2 = "2021-04-11";

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
  app.use("/api/pagos/historial-cajeros", require("../routes/historialCajerosRoutes"));
  app.use("/api/pagos", require("../routes/pagosRoutes")); // igual que en index.js: historial-cajeros va antes
  app.use(errorHandler);
  await new Promise((ok) => { servidor = app.listen(0, ok); });
  base = `http://localhost:${servidor.address().port}/api/pagos`;

  const simple = async (clave, metodo, monto, cajero, caja, dia, hora) => {
    ops[clave] = (await registrarPagoSimple({ metodo, monto, caja_id: caja, cajero })).pago;
    await moverA(ops[clave].id_transaccion, dia, hora);
  };
  await simple("a1", "Efectivo", 15, CAJERO_A, CAJA_1, D1, "08:30");
  await simple("b1", "Tarjeta", 60, CAJERO_B, CAJA_2, D1, "12:00");
  ops.a2 = (await registrarPagoMixto({
    cajaId: CAJA_1, cajero: CAJERO_A, total: 30,
    metodos: [{ metodo: "Tarjeta", monto: 10 }, { metodo: "QR", monto: 20 }],
  })).pago;
  await moverA(ops.a2.id_transaccion, D2, "10:15");
  await simple("b2", "QR", 12.5, CAJERO_B, CAJA_2, D2, "17:45");
  await marcarRevision({ id_transaccion: ops.b1.id_transaccion, estado: "OBSERVADA", nota: "Monto alto sin voucher", revisado_por: "supervisor.http" });
  ops.hoy = (await registrarPagoSimple({ metodo: "Efectivo", monto: 9, caja_id: CAJA_1, cajero: CAJERO_A })).pago;
});

test.after(async () => {
  const cajeros = [CAJERO_A, CAJERO_B];
  await pool.query(
    "DELETE FROM pagos.revisiones_transaccion WHERE id_transaccion IN (SELECT id_transaccion FROM pagos.transacciones WHERE cajero_id = ANY($1))",
    [cajeros]
  );
  await pool.query("DELETE FROM pagos.transacciones WHERE cajero_id = ANY($1)", [cajeros]);
  await pool.query("DELETE FROM pagos.pagos_mixtos WHERE caja_id = ANY($1)", [[CAJA_1, CAJA_2]]);
  servidor.close();
  await pool.end();
});

const pedir = async (query = {}) => {
  const qs = new URLSearchParams(query).toString();
  const r = await fetch(`${base}/historial-cajeros${qs ? `?${qs}` : ""}`);
  return { status: r.status, headers: r.headers, cuerpo: await r.json() };
};
const ids = (cuerpo) => cuerpo.data.operaciones.map((o) => o.id_transaccion);

test("TDSI-434: GET /historial-cajeros devuelve operaciones, paginacion y resumen del rango", async () => {
  const { status, headers, cuerpo } = await pedir({ desde: D1, hasta: D2 });
  assert.equal(status, 200);
  assert.equal(cuerpo.ok, true);
  assert.equal(headers.get("cache-control"), "no-store");

  const d = cuerpo.data;
  assert.deepEqual(d.filtros, { desde: D1, hasta: D2, cajero_id: null, caja_id: null, metodo: null, estado_revision: null });
  assert.deepEqual(d.paginacion, { pagina: 1, por_pagina: 20, total_registros: 4, total_paginas: 1 });
  assert.deepEqual(ids(cuerpo), [ops.b2, ops.a2, ops.b1, ops.a1].map((o) => o.id_transaccion));

  const mixta = d.operaciones[1];
  assert.equal(mixta.hora, "10:15:00");
  assert.deepEqual(mixta.metodos, ["Tarjeta", "QR"]);
  assert.equal(mixta.total, 30);

  assert.equal(d.resumen.cantidad_operaciones, 4);
  assert.equal(d.resumen.total, 117.5);
  assert.deepEqual(d.resumen.por_cajero.map((c) => [c.cajero_id, c.cantidad_operaciones, c.total, c.dias_con_operaciones]),
    [[CAJERO_A, 2, 45, 2], [CAJERO_B, 2, 72.5, 2]]);
  assert.deepEqual(d.resumen.por_dia.map((x) => [x.fecha, x.cantidad_operaciones, x.total, x.cajeros.length]),
    [[D2, 2, 42.5, 2], [D1, 2, 75, 2]]);
});

test("TDSI-434: filtros por query string (cajero, caja, metodo, estado de revision, pagina)", async () => {
  const soloA = await pedir({ desde: D1, hasta: D2, cajero_id: CAJERO_A });
  assert.deepEqual(ids(soloA.cuerpo), [ops.a2.id_transaccion, ops.a1.id_transaccion]);

  const caja2 = await pedir({ desde: D1, hasta: D2, caja_id: CAJA_2 });
  assert.deepEqual(ids(caja2.cuerpo), [ops.b2.id_transaccion, ops.b1.id_transaccion]);

  const tarjeta = await pedir({ desde: D1, hasta: D2, metodo: "tarjeta" });
  assert.equal(tarjeta.cuerpo.data.filtros.metodo, "Tarjeta");
  assert.deepEqual(ids(tarjeta.cuerpo), [ops.a2.id_transaccion, ops.b1.id_transaccion]);

  const observadas = await pedir({ desde: D1, hasta: D2, estado_revision: "OBSERVADA" });
  assert.deepEqual(ids(observadas.cuerpo), [ops.b1.id_transaccion]);
  assert.deepEqual(observadas.cuerpo.data.operaciones[0].revision.nota, "Monto alto sin voucher");

  const dia = await pedir({ fecha: D1, por_pagina: 1, pagina: 2 });
  assert.deepEqual(dia.cuerpo.data.paginacion, { pagina: 2, por_pagina: 1, total_registros: 2, total_paginas: 2 });
  assert.deepEqual(ids(dia.cuerpo), [ops.a1.id_transaccion]);
});

test("TDSI-434: sin fechas devuelve los ultimos 7 dias hasta hoy", async () => {
  const { status, cuerpo } = await pedir({ cajero_id: CAJERO_A });
  assert.equal(status, 200);
  assert.equal(cuerpo.data.filtros.hasta, hoyLocal());
  assert.deepEqual(ids(cuerpo), [ops.hoy.id_transaccion]);
});

test("TDSI-434: 400 con mensaje si algun filtro es invalido", async () => {
  const casos = [
    { fecha: "2021-04-31" },
    { desde: D2, hasta: D1 },
    { desde: "2021-01-01", hasta: "2021-06-30" },
    { metodo: "Cheque" },
    { estado_revision: "APROBADA" },
    { caja_id: "C".repeat(61) },
    { pagina: "0" },
    { por_pagina: "500" },
  ];
  for (const q of casos) {
    const { status, cuerpo } = await pedir(q);
    assert.equal(status, 400, JSON.stringify(q));
    assert.equal(cuerpo.ok, false);
    assert.ok(cuerpo.mensaje, JSON.stringify(q));
  }
});

test("TDSI-434: no pisa la ruta existente GET /api/pagos/historial", async () => {
  const r = await fetch(`${base}/historial`);
  assert.equal(r.status, 200);
  const cuerpo = await r.json();
  assert.ok(Array.isArray(cuerpo.historial)); // la respuesta de siempre: { total, historial }
});