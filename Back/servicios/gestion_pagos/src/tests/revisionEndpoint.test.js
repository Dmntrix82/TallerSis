// TDSI-131: pruebas HTTP de la API de revision de transacciones por cajero
// (usa la BD real con su propio cajero de prueba; limpia lo que crea).
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { pool } = require("../config/db");
const { errorHandler } = require("../middlewares/errorHandler");
const { registrarPagoSimple } = require("../services/pagoSimpleService");
const { registrarPagoMixto } = require("../services/pagoMixtoService");
const { hoyLocal } = require("../utils/fechaLocal");

const SUFIJO = Date.now();
const CAJERO = `test.rev.ep.${SUFIJO}@tallersis.bo`;
const CAJA = `TEST-REVEP-${SUFIJO}`;
const HOY = hoyLocal();

let servidor;
let base;
const ventas = {};

test.before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/pagos/revision", require("../routes/revisionRoutes"));
  app.use("/api/pagos", require("../routes/pagosRoutes")); // igual que en index.js: revision va antes
  app.use(errorHandler);
  await new Promise((ok) => { servidor = app.listen(0, ok); });
  base = `http://localhost:${servidor.address().port}/api/pagos/revision`;

  ventas.efectivo = (await registrarPagoSimple({ metodo: "Efectivo", monto: 12, caja_id: CAJA, cajero: CAJERO })).pago;
  ventas.qr = (await registrarPagoSimple({ metodo: "QR", monto: 8, caja_id: CAJA, cajero: CAJERO })).pago;
  ventas.mixta = (await registrarPagoMixto({
    cajaId: CAJA, cajero: CAJERO, total: 20,
    metodos: [{ metodo: "Tarjeta", monto: 15 }, { metodo: "Efectivo", monto: 5 }],
  })).pago;
});

test.after(async () => {
  await pool.query(
    "DELETE FROM pagos.revisiones_transaccion WHERE id_transaccion IN (SELECT id_transaccion FROM pagos.transacciones WHERE cajero_id = $1)",
    [CAJERO]
  );
  await pool.query("DELETE FROM pagos.transacciones WHERE cajero_id = $1", [CAJERO]);
  await pool.query("DELETE FROM pagos.pagos_mixtos WHERE caja_id = $1", [CAJA]);
  servidor.close();
  await pool.end();
});

const pedir = async (ruta, opciones = {}) => {
  const r = await fetch(`${base}${ruta}`, {
    ...opciones,
    headers: { "Content-Type": "application/json" },
    body: opciones.body ? JSON.stringify(opciones.body) : undefined,
  });
  return { status: r.status, cuerpo: await r.json() };
};
const q = (obj) => `?${new URLSearchParams(obj)}`;

test("TDSI-131: GET /cajeros lista los cajeros con ventas del dia", async () => {
  const { status, cuerpo } = await pedir("/cajeros");
  assert.equal(status, 200);
  assert.equal(cuerpo.data.filtros.desde, HOY);
  const c = cuerpo.data.cajeros.find((x) => x.cajero_id === CAJERO);
  assert.deepEqual(
    { cantidad: c.cantidad_transacciones, total: c.total, sin_revisar: c.sin_revisar, observadas: c.observadas },
    { cantidad: 3, total: 40, sin_revisar: 3, observadas: 0 }
  );
});

test("TDSI-131: GET /transacciones lista las del cajero con filtros y paginacion", async () => {
  const todas = await pedir(`/transacciones${q({ cajero_id: CAJERO })}`);
  assert.equal(todas.status, 200);
  assert.equal(todas.cuerpo.data.paginacion.total_registros, 3);
  assert.equal(todas.cuerpo.data.transacciones[0].id_transaccion, ventas.mixta.id_transaccion);
  assert.equal(todas.cuerpo.data.transacciones[0].revision.estado, "PENDIENTE");

  const efectivo = await pedir(`/transacciones${q({ cajero_id: CAJERO, metodo: "Efectivo" })}`);
  assert.deepEqual(efectivo.cuerpo.data.transacciones.map((t) => t.id_transaccion).sort(),
    [ventas.efectivo.id_transaccion, ventas.mixta.id_transaccion].sort());

  const pagina2 = await pedir(`/transacciones${q({ cajero_id: CAJERO, por_pagina: 2, pagina: 2 })}`);
  assert.deepEqual(pagina2.cuerpo.data.paginacion, { pagina: 2, por_pagina: 2, total_registros: 3, total_paginas: 2 });
  assert.equal(pagina2.cuerpo.data.transacciones.length, 1);
});

test("TDSI-131: GET /resumen devuelve cantidad y total por metodo", async () => {
  const { status, cuerpo } = await pedir(`/resumen${q({ cajero_id: CAJERO })}`);
  assert.equal(status, 200);
  assert.equal(cuerpo.data.total, 40);
  assert.deepEqual(cuerpo.data.por_metodo, [
    { metodo: "Efectivo", cantidad: 2, total: 17 },
    { metodo: "Tarjeta", cantidad: 1, total: 15 },
    { metodo: "QR", cantidad: 1, total: 8 },
  ]);
});

test("TDSI-131: PUT /transacciones/:id marca REVISADA u OBSERVADA y se refleja en la lista y el resumen", async () => {
  const revisada = await pedir(`/transacciones/${ventas.efectivo.id_transaccion}`, {
    method: "PUT", body: { estado: "REVISADA", revisado_por: "supervisor.http" },
  });
  assert.equal(revisada.status, 200);
  assert.equal(revisada.cuerpo.data.estado, "REVISADA");
  assert.match(revisada.cuerpo.mensaje, /REVISADA/);

  const observada = await pedir(`/transacciones/${ventas.mixta.id_transaccion}`, {
    method: "PUT", body: { estado: "OBSERVADA", nota: "Revisar el voucher de tarjeta", revisado_por: "supervisor.http" },
  });
  assert.equal(observada.status, 200);
  assert.equal(observada.cuerpo.data.nota, "Revisar el voucher de tarjeta");

  const observadas = await pedir(`/transacciones${q({ cajero_id: CAJERO, estado_revision: "OBSERVADA" })}`);
  assert.deepEqual(observadas.cuerpo.data.transacciones.map((t) => t.id_transaccion), [ventas.mixta.id_transaccion]);

  const resumen = await pedir(`/resumen${q({ cajero_id: CAJERO })}`);
  assert.deepEqual(resumen.cuerpo.data.revision, { revisadas: 1, observadas: 1, sin_revisar: 1 });

  const cajeros = await pedir("/cajeros");
  const c = cajeros.cuerpo.data.cajeros.find((x) => x.cajero_id === CAJERO);
  assert.equal(c.sin_revisar, 1);
  assert.equal(c.observadas, 1);
});

test("TDSI-131: errores: 400 con mensaje y 404 si la transaccion no existe", async () => {
  const casos = [
    ["/transacciones", {}],
    ["/transacciones" + q({ cajero_id: CAJERO, metodo: "Cheque" }), {}],
    ["/transacciones" + q({ cajero_id: CAJERO, por_pagina: 500 }), {}],
    ["/resumen", {}],
    ["/cajeros" + q({ fecha: "2026-13-01" }), {}],
    [`/transacciones/${ventas.qr.id_transaccion}`, { method: "PUT", body: { estado: "OBSERVADA", revisado_por: "s" } }],
    [`/transacciones/${ventas.qr.id_transaccion}`, { method: "PUT", body: { estado: "REVISADA" } }],
  ];
  for (const [ruta, opciones] of casos) {
    const { status, cuerpo } = await pedir(ruta, opciones);
    assert.equal(status, 400, ruta);
    assert.equal(cuerpo.ok, false);
    assert.ok(cuerpo.mensaje, ruta);
  }
  const noExiste = await pedir("/transacciones/NO-EXISTE-123", { method: "PUT", body: { estado: "REVISADA", revisado_por: "s" } });
  assert.equal(noExiste.status, 404);
});

test("TDSI-131: no interfiere con las rutas existentes de /api/pagos", async () => {
  const r = await fetch(base.replace("/revision", "/historial"));
  assert.equal(r.status, 200);
});