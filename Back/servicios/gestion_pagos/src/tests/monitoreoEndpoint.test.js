// TDSI-426/123: pruebas HTTP de GET /api/pagos/monitoreo y de su version en tiempo real (/stream)
// Levanta solo las rutas de pagos en un puerto libre, sin arrancar src/index.js.
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { pool } = require("../config/db");
const { errorHandler } = require("../middlewares/errorHandler");
const { registrarPagoSimple } = require("../services/pagoSimpleService");
const { actualizarEstado } = require("../services/transaccionesEstadoService");

const SUFIJO = Date.now();
const CAJERO_A = `test.endpoint.a.${SUFIJO}@tallersis.bo`;
const CAJERO_B = `test.endpoint.b.${SUFIJO}@tallersis.bo`;
const CAJA_1 = `TEST-EP1-${SUFIJO}`;
const CAJA_2 = `TEST-EP2-${SUFIJO}`;

let servidor;
let base;

test.before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/pagos/monitoreo", require("../routes/monitoreoRoutes"));
  app.use("/api/pagos", require("../routes/pagosRoutes")); // igual que en index.js: monitoreo va antes
  app.use(errorHandler);
  await new Promise((ok) => { servidor = app.listen(0, ok); });
  base = `http://localhost:${servidor.address().port}/api/pagos/monitoreo`;

  await registrarPagoSimple({ metodo: "Efectivo", monto: 10, caja_id: CAJA_1, cajero: CAJERO_A });
  await registrarPagoSimple({ metodo: "QR", monto: 20, caja_id: CAJA_1, cajero: CAJERO_A });
  await registrarPagoSimple({ metodo: "Tarjeta", monto: 50, caja_id: CAJA_2, cajero: CAJERO_B });
});

test.after(async () => {
  await pool.query("DELETE FROM pagos.transacciones WHERE cajero_id = ANY($1)", [[CAJERO_A, CAJERO_B]]);
  servidor.close();
  await pool.end();
});

const pedir = async (query = "") => {
  const r = await fetch(`${base}${query}`);
  return { status: r.status, headers: r.headers, cuerpo: await r.json() };
};
const tarjeta = (cuerpo, cajero) => cuerpo.data.cajeros.find((c) => c.cajero_id === cajero);

test("TDSI-426: GET /api/pagos/monitoreo devuelve una tarjeta por cajero con resumen y ultimas operaciones", async () => {
  const { status, headers, cuerpo } = await pedir();
  assert.equal(status, 200);
  assert.equal(cuerpo.ok, true);
  assert.equal(headers.get("cache-control"), "no-store");
  assert.match(cuerpo.data.fecha, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(!Number.isNaN(Date.parse(cuerpo.data.actualizado_en)));

  const a = tarjeta(cuerpo, CAJERO_A);
  assert.equal(a.caja_id, CAJA_1);
  assert.equal(a.cantidad_operaciones, 2);
  assert.equal(a.total, 30);
  assert.equal(a.ultima_operacion.monto, 20);
  assert.deepEqual(a.operaciones.map((o) => o.monto), [20, 10]);
  for (const o of a.operaciones) {
    assert.match(o.hora, /^\d{2}:\d{2}:\d{2}$/);
    assert.ok(Array.isArray(o.metodos));
    assert.equal(o.estado, "APROBADA");
  }
});

test("TDSI-426: filtra por caja", async () => {
  const { cuerpo } = await pedir(`?caja_id=${encodeURIComponent(CAJA_2)}`);
  assert.deepEqual(cuerpo.data.cajeros.map((c) => c.cajero_id), [CAJERO_B]);
  assert.equal(cuerpo.data.filtros.caja_id, CAJA_2);
  assert.deepEqual(cuerpo.data.totales, { cajeros: 1, cantidad_operaciones: 1, total: 50 });
});

test("TDSI-426: filtra por cajero y respeta el limite de operaciones", async () => {
  const { cuerpo } = await pedir(`?cajero_id=${encodeURIComponent(CAJERO_A)}&limite=1`);
  assert.equal(cuerpo.data.cajeros.length, 1);
  const a = cuerpo.data.cajeros[0];
  assert.equal(a.cajero_id, CAJERO_A);
  assert.equal(a.operaciones.length, 1, "limite=1");
  assert.equal(a.cantidad_operaciones, 2, "el resumen cuenta todo el dia, no solo las listadas");
});

test("TDSI-426: combinar caja y cajero que no coinciden devuelve 'sin operaciones'", async () => {
  const { status, cuerpo } = await pedir(`?caja_id=${encodeURIComponent(CAJA_2)}&cajero_id=${encodeURIComponent(CAJERO_A)}`);
  assert.equal(status, 200);
  assert.deepEqual(cuerpo.data.cajeros, []);
  assert.deepEqual(cuerpo.data.totales, { cajeros: 0, cantidad_operaciones: 0, total: 0 });
});

test("TDSI-426: una venta nueva aparece en la siguiente consulta (actualizacion en vivo)", async () => {
  const { pago } = await registrarPagoSimple({ metodo: "QR", monto: 7.5, caja_id: CAJA_2, cajero: CAJERO_B });
  const { cuerpo } = await pedir(`?cajero_id=${encodeURIComponent(CAJERO_B)}`);
  const b = cuerpo.data.cajeros[0];
  assert.equal(b.ultima_operacion.id_transaccion, pago.id_transaccion);
  assert.equal(b.operaciones[0].id_transaccion, pago.id_transaccion);
  assert.equal(b.total, 57.5);
});

test("TDSI-426: filtros invalidos responden 400 con el mensaje", async () => {
  for (const q of ["?limite=0", "?limite=abc", "?fecha=2026-02-31", `?caja_id=${"x".repeat(61)}`]) {
    const { status, cuerpo } = await pedir(q);
    assert.equal(status, 400, q);
    assert.equal(cuerpo.ok, false);
    assert.ok(cuerpo.mensaje, q);
  }
});

test("TDSI-426: no interfiere con las rutas existentes de /api/pagos", async () => {
  const r = await fetch(base.replace("/monitoreo", "/historial"));
  assert.equal(r.status, 200);
});


// ---------- TDSI-123: tiempo real (Server-Sent Events) ----------

/** Abre el stream y devuelve una funcion que espera el siguiente evento "data:" (con timeout). */
async function abrirStream(query) {
  const controlador = new AbortController();
  const r = await fetch(`${base}/stream${query}`, { signal: controlador.signal });
  const lector = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  async function siguienteEvento(timeoutMs = 3000) {
    const limite = Date.now() + timeoutMs;
    for (;;) {
      const fin = buffer.indexOf("\n\n");
      if (fin !== -1) {
        const bloque = buffer.slice(0, fin);
        buffer = buffer.slice(fin + 2);
        const linea = bloque.split("\n").find((l) => l.startsWith("data: "));
        if (linea) return JSON.parse(linea.slice(6));
        continue; // "retry:" o comentario ": ping"
      }
      const restante = limite - Date.now();
      if (restante <= 0) throw new Error("no llego ningun evento a tiempo");
      const { value, done } = await Promise.race([
        lector.read(),
        new Promise((_, no) => setTimeout(() => no(new Error("no llego ningun evento a tiempo")), restante)),
      ]);
      if (done) throw new Error("el stream se cerro");
      buffer += decoder.decode(value, { stream: true });
    }
  }

  return { respuesta: r, siguienteEvento, cerrar: () => controlador.abort() };
}

test("TDSI-123: el stream envia el monitoreo al conectarse y otra vez apenas entra una venta", async () => {
  const s = await abrirStream(`?cajero_id=${encodeURIComponent(CAJERO_A)}`);
  try {
    assert.equal(s.respuesta.status, 200);
    assert.match(s.respuesta.headers.get("content-type"), /text\/event-stream/);

    const inicial = await s.siguienteEvento();
    assert.equal(inicial.cajeros[0].cajero_id, CAJERO_A);
    const antes = inicial.cajeros[0].cantidad_operaciones;

    const { pago } = await registrarPagoSimple({ metodo: "Efectivo", monto: 3, caja_id: CAJA_1, cajero: CAJERO_A });
    const enVivo = await s.siguienteEvento();
    assert.equal(enVivo.cajeros[0].cantidad_operaciones, antes + 1);
    assert.equal(enVivo.cajeros[0].ultima_operacion.id_transaccion, pago.id_transaccion);
  } finally {
    s.cerrar();
  }
});

test("TDSI-123: un cambio de estado (PENDIENTE -> APROBADA) tambien se envia en vivo", async () => {
  const { pago } = await registrarPagoSimple({ metodo: "QR", monto: 4, caja_id: CAJA_2, cajero: CAJERO_B });
  await pool.query("UPDATE pagos.transacciones SET estado_pago = 'PENDIENTE' WHERE id_transaccion = $1", [pago.id_transaccion]);

  const s = await abrirStream(`?cajero_id=${encodeURIComponent(CAJERO_B)}`);
  try {
    const inicial = await s.siguienteEvento();
    assert.equal(inicial.cajeros[0].ultima_operacion.estado, "PENDIENTE");

    await actualizarEstado(pago.id_transaccion, { estado: "APROBADA" });
    const enVivo = await s.siguienteEvento();
    assert.equal(enVivo.cajeros[0].ultima_operacion.estado, "APROBADA");
  } finally {
    s.cerrar();
  }
});

test("TDSI-123: el stream con un filtro invalido responde 400 normal (no abre la conexion)", async () => {
  const r = await fetch(`${base}/stream?limite=0`);
  assert.equal(r.status, 400);
  assert.equal((await r.json()).ok, false);
});