// TDSI-46/867: buscador de la pantalla "Facturas" (GET /api/pagos/mis-facturas?q=).
// Usa la BD real y limpia lo que crea. Las ventas se mueven a dias fijos de 2021 para
// poder probar la combinacion con el filtro de fechas sin chocar con otras ventas.
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { pool } = require("../config/db");
const { errorHandler } = require("../middlewares/errorHandler");
const { registrarPagoSimple } = require("../services/pagoSimpleService");
const { registrarPagoMixto } = require("../services/pagoMixtoService");
const { listarMisFacturas } = require("../services/ventasCajeroService");

const SUFIJO = Date.now();
const CAJERO_A = `test.busqueda.a.${SUFIJO}@tallersis.bo`;
const CAJERO_B = `test.busqueda.b.${SUFIJO}@tallersis.bo`;
const CAJA = `TEST-BUS-${SUFIJO}`;
const CI_JOSE = String(SUFIJO).slice(-8);
const NIT_MARIA = String(SUFIJO + 7).slice(-10);
const D1 = "2021-04-01";
const D2 = "2021-04-02";
const D3 = "2021-04-03";

/** Mueve una venta a un dia y hora fijos (hora de Bolivia). */
const moverA = (idTransaccion, dia, hora) =>
  pool.query(
    "UPDATE pagos.transacciones SET fecha = ($2::date + $3::time)::timestamp AT TIME ZONE 'America/La_Paz' WHERE id_transaccion = $1",
    [idTransaccion, dia, hora]
  );

const ventas = {};
let servidor;
let base;

const jose = { tipo_documento: "CI", nit: CI_JOSE, razon_social: "José Pérez Ñandú" };
const maria = { tipo_documento: "NIT", nit: NIT_MARIA, razon_social: "María López" };

test.before(async () => {
  const simple = async (clave, cajero, cliente, dia, hora, monto) => {
    ventas[clave] = (await registrarPagoSimple({ metodo: "QR", monto, caja_id: CAJA, cajero, ...cliente })).pago;
    await moverA(ventas[clave].id_transaccion, dia, hora);
  };
  await simple("a1", CAJERO_A, jose, D1, "10:00", 50);
  await simple("a2", CAJERO_A, jose, D2, "11:00", 30);
  ventas.a3 = (await registrarPagoMixto({
    cajaId: CAJA, cajero: CAJERO_A, total: 20, ...maria,
    metodos: [{ metodo: "Efectivo", monto: 5 }, { metodo: "QR", monto: 15 }],
  })).pago;
  await moverA(ventas.a3.id_transaccion, D2, "12:00");
  await simple("a4", CAJERO_A, {}, D3, "09:00", 15);
  await simple("b1", CAJERO_B, jose, D1, "13:00", 40);

  const app = express();
  app.use(express.json());
  app.use("/api/pagos", require("../routes/pagosRoutes"));
  app.use(errorHandler);
  await new Promise((ok) => { servidor = app.listen(0, ok); });
  base = `http://localhost:${servidor.address().port}/api/pagos/mis-facturas`;
});

test.after(async () => {
  await new Promise((ok) => servidor.close(ok));
  await pool.query("DELETE FROM pagos.transacciones WHERE cajero = ANY($1)", [[CAJERO_A, CAJERO_B]]);
  await pool.query("DELETE FROM pagos.pagos_mixtos WHERE caja_id = $1", [CAJA]);
  await pool.end();
});

const buscar = async (q, extra = {}) => (await listarMisFacturas(CAJERO_A, { q, ...extra })).map((f) => f.id_transaccion);
const id = (clave) => ventas[clave].id_transaccion;
const numero = (clave) => String(Number(id(clave).replace(/\D/g, "")));

test("TDSI-169/872: el N° de factura completo, sin ceros o en minusculas muestra solo esa factura", async () => {
  assert.deepEqual(await buscar(id("a1")), [id("a1")]);
  assert.deepEqual(await buscar(numero("a1")), [id("a1")]);
  assert.deepEqual(await buscar(id("a1").toLowerCase()), [id("a1")]);
});

test("TDSI-169/873: el NIT/CI muestra todas las facturas de ese cliente (el pago mixto una sola vez)", async () => {
  assert.deepEqual(await buscar(CI_JOSE), [id("a2"), id("a1")]);
  assert.deepEqual(await buscar(NIT_MARIA), [id("a3")]);
});

test("TDSI-864/874: el nombre se encuentra sin importar mayusculas ni tildes", async () => {
  const esperado = [id("a2"), id("a1")];
  assert.deepEqual(await buscar("jose perez"), esperado);
  assert.deepEqual(await buscar("JOSÉ PÉREZ"), esperado);
  assert.deepEqual(await buscar("nandu"), esperado);
  assert.deepEqual(await buscar("  Maria  "), [id("a3")]);
});

test("TDSI-865: la busqueda se combina con el filtro de fechas", async () => {
  assert.deepEqual(await buscar(CI_JOSE, { desde: D2, hasta: D2 }), [id("a2")]);
  assert.deepEqual(await buscar("jose", { desde: D1, hasta: D1 }), [id("a1")]);
  assert.deepEqual(await buscar("maria", { desde: D3 }), []);
  // sin texto, el filtro de fechas sigue funcionando igual que antes
  assert.deepEqual(await buscar("", { desde: D3, hasta: D3 }), [id("a4")]);
});

test("TDSI-866: solo salen las facturas del cajero de la sesion", async () => {
  const deB = (await listarMisFacturas(CAJERO_B, { q: id("a1") })).map((f) => f.id_transaccion);
  assert.deepEqual(deB, []);
  const joseDeB = (await listarMisFacturas(CAJERO_B, { q: "jose" })).map((f) => f.id_transaccion);
  assert.deepEqual(joseDeB, [id("b1")]);
  const mayusculas = (await listarMisFacturas(`  ${CAJERO_A.toUpperCase()} `, { q: id("a1") })).map((f) => f.id_transaccion);
  assert.deepEqual(mayusculas, [id("a1")]);
});

test("TDSI-875: un dato que no existe no devuelve facturas, y % o _ se buscan literal", async () => {
  assert.deepEqual(await buscar("no existe zzz"), []);
  assert.deepEqual(await buscar("%"), []);
  assert.deepEqual(await buscar("_"), []);
});

test("TDSI-876: sin texto de busqueda se listan todas las facturas del cajero", async () => {
  assert.deepEqual(await buscar(undefined, { desde: D1, hasta: D3 }), [id("a4"), id("a3"), id("a2"), id("a1")]);
  assert.deepEqual(await buscar("   ", { desde: D1, hasta: D3 }), [id("a4"), id("a3"), id("a2"), id("a1")]);
});

test("TDSI-169/865/866: validaciones del buscador", async () => {
  await assert.rejects(() => listarMisFacturas(CAJERO_A, { q: "x".repeat(101) }), { status: 400 });
  await assert.rejects(() => listarMisFacturas(CAJERO_A, { desde: D3, hasta: D1 }), { status: 400 });
  await assert.rejects(() => listarMisFacturas(CAJERO_A, { desde: "2021-02-30" }), { status: 400 });
  await assert.rejects(() => listarMisFacturas([CAJERO_A, CAJERO_B], {}), { status: 400 });
  await assert.rejects(() => listarMisFacturas("", { q: "jose" }), { status: 400 });
});

test("TDSI-867: GET /api/pagos/mis-facturas?q= por HTTP", async () => {
  const url = (params) => `${base}?${new URLSearchParams(params)}`;

  let r = await fetch(url({ cajero: CAJERO_A, q: "JOSE perez", desde: D1, hasta: D3 }));
  assert.equal(r.status, 200);
  let body = await r.json();
  assert.deepEqual(body.data.map((f) => f.id_transaccion), [id("a2"), id("a1")]);
  assert.equal(body.data[0].razon_social, "José Pérez Ñandú");

  r = await fetch(`${url({ cajero: CAJERO_A, q: "jose" })}&cajero=${encodeURIComponent(CAJERO_B)}`);
  assert.equal(r.status, 400);

  r = await fetch(url({ cajero: CAJERO_A, desde: D3, hasta: D1 }));
  assert.equal(r.status, 400);
  body = await r.json();
  assert.match(body.mensaje, /posterior/);
});

test("TDSI-46: \"VTA-54\", \"vta 54\" y \"VTA54\" buscan la factura exacta; \"VTA-0000\" sigue siendo parcial", async () => {
  const n = numero("a1");
  for (const q of [`VTA-${n}`, `vta ${n}`, `VTA${n}`]) {
    assert.deepEqual(await buscar(q), [id("a1")], q);
  }
  const parcial = await buscar("VTA-0", { desde: D1, hasta: D3 });
  assert.ok(parcial.includes(id("a1")) && parcial.length > 1, "VTA-0 tiene que traer varias facturas");
});

test("TDSI-46: un id con muchos digitos al final no rompe la busqueda por numero", async () => {
  // Antes el numero se convertia a bigint y este id hacia fallar toda la consulta (error 500).
  const idLargo = `IMP-${SUFIJO}12345678`;
  await pool.query(
    `INSERT INTO pagos.transacciones (id_transaccion, metodo, monto, tipo_pago, cajero, estado)
     VALUES ($1, 'Efectivo', 5, 'Simple', $2, 'Registrado')`,
    [idLargo, CAJERO_A]
  );
  try {
    assert.deepEqual(await buscar(numero("a1")), [id("a1")]);
    assert.deepEqual(await buscar(`0${numero("a1")}`), [id("a1")]);
  } finally {
    await pool.query("DELETE FROM pagos.transacciones WHERE id_transaccion = $1", [idLargo]);
  }
});
