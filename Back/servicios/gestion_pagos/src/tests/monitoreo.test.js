// TDSI-23: monitoreo de operaciones de cajeros (usa la BD real; limpia lo que crea).
const test = require("node:test");
const assert = require("node:assert/strict");
const { pool } = require("../config/db");
const { registrarPagoSimple } = require("../services/pagoSimpleService");
const { registrarPagoMixto } = require("../services/pagoMixtoService");
const { listarUltimasOperaciones, obtenerResumenPorCajero } = require("../services/monitoreoService");

const SUFIJO = Date.now();
const CAJERO = `test.monitoreo.${SUFIJO}@tallersis.bo`;
const CAJERO_2 = `test.monitoreo2.${SUFIJO}@tallersis.bo`;
const CAJA = `TEST-MON-${SUFIJO}`;
const CAJA_2 = `TEST-MON2-${SUFIJO}`;

test.after(async () => {
  await pool.query("DELETE FROM pagos.transacciones WHERE cajero_id = ANY($1) OR cajero = ANY($1)", [[CAJERO, CAJERO_2]]);
  await pool.query("DELETE FROM pagos.pagos_mixtos WHERE caja_id = ANY($1)", [[CAJA, CAJA_2]]);
  await pool.end();
});

test("TDSI-423: el pago simple guarda cajero_id y caja_id", async () => {
  const { pago } = await registrarPagoSimple({ metodo: "QR", monto: 10, caja_id: CAJA, cajero: CAJERO, cajero_id: CAJERO });
  assert.equal(pago.cajero_id, CAJERO);
  assert.equal(pago.caja_id, CAJA);
});

test("TDSI-423: si el front no manda cajero_id, se usa el cajero (email)", async () => {
  const { pago } = await registrarPagoSimple({ metodo: "Efectivo", monto: 5, caja_id: CAJA, cajero: CAJERO });
  assert.equal(pago.cajero_id, CAJERO);
});

test("TDSI-423: el pago mixto guarda cajero_id y caja_id en cada metodo", async () => {
  const r = await registrarPagoMixto({
    cajaId: CAJA_2, cajero: CAJERO_2, total: 30,
    metodos: [{ metodo: "Efectivo", monto: 10 }, { metodo: "Tarjeta", monto: 20 }],
  });
  assert.equal(r.transacciones.length, 2);
  for (const t of r.transacciones) {
    assert.equal(t.cajero_id, CAJERO_2);
    assert.equal(t.caja_id, CAJA_2);
  }
});

// A partir de aqui: CAJERO tiene 2 ventas en CAJA (de los tests anteriores) y CAJERO_2 una mixta en CAJA_2.

const delCajero = (r, cajero) => r.cajeros.find((c) => c.cajero_id === cajero);

test("TDSI-424: lista las ultimas operaciones de cada cajero, de la mas reciente a la mas antigua", async () => {
  for (const monto of [11, 12, 13, 14, 15]) {
    await registrarPagoSimple({ metodo: "Efectivo", monto, caja_id: CAJA, cajero: CAJERO });
  }
  const r = await listarUltimasOperaciones({});
  const c1 = delCajero(r, CAJERO);
  assert.ok(c1, "aparece el cajero");
  assert.equal(c1.caja_id, CAJA);
  assert.equal(c1.operaciones.length, 5, "por defecto, las 5 ultimas");
  assert.deepEqual(c1.operaciones.map((o) => o.monto), [15, 14, 13, 12, 11]);
  const op = c1.operaciones[0];
  assert.match(op.hora, /^\d{2}:\d{2}:\d{2}$/);
  assert.deepEqual(op.metodos, ["Efectivo"]);
  assert.equal(op.estado, "APROBADA");
});

test("TDSI-424: el pago mixto aparece como UNA operacion con sus metodos y el monto total", async () => {
  const c2 = delCajero(await listarUltimasOperaciones({}), CAJERO_2);
  assert.equal(c2.operaciones.length, 1);
  assert.deepEqual(c2.operaciones[0].metodos, ["Efectivo", "Tarjeta"]);
  assert.equal(c2.operaciones[0].monto, 30);
  assert.equal(c2.operaciones[0].tipo_pago, "Mixto");
});

test("TDSI-424: muestra el estado de cada operacion (ANULADA, RECHAZADA, PENDIENTE)", async () => {
  const { pago: a } = await registrarPagoSimple({ metodo: "QR", monto: 21, caja_id: CAJA, cajero: CAJERO });
  const { pago: b } = await registrarPagoSimple({ metodo: "QR", monto: 22, caja_id: CAJA, cajero: CAJERO });
  const { pago: c } = await registrarPagoSimple({ metodo: "QR", monto: 23, caja_id: CAJA, cajero: CAJERO });
  await pool.query("UPDATE pagos.transacciones SET estado = 'Anulado' WHERE id_transaccion = $1", [a.id_transaccion]);
  await pool.query("UPDATE pagos.transacciones SET estado_pago = 'RECHAZADA' WHERE id_transaccion = $1", [b.id_transaccion]);
  await pool.query("UPDATE pagos.transacciones SET estado_pago = 'PENDIENTE' WHERE id_transaccion = $1", [c.id_transaccion]);

  const ops = delCajero(await listarUltimasOperaciones({ cajero_id: CAJERO }), CAJERO).operaciones;
  const estado = (id) => ops.find((o) => o.id_transaccion === id).estado;
  assert.equal(estado(a.id_transaccion), "ANULADA");
  assert.equal(estado(b.id_transaccion), "RECHAZADA");
  assert.equal(estado(c.id_transaccion), "PENDIENTE");
});

test("TDSI-424: filtra por caja y por cajero, y respeta el limite", async () => {
  const porCaja = await listarUltimasOperaciones({ caja_id: CAJA_2 });
  assert.deepEqual(porCaja.cajeros.map((c) => c.cajero_id), [CAJERO_2]);

  const porCajero = await listarUltimasOperaciones({ cajero_id: CAJERO, limite: 2 });
  assert.deepEqual(porCajero.cajeros.map((c) => c.cajero_id), [CAJERO]);
  assert.equal(porCajero.cajeros[0].operaciones.length, 2);
});

test("TDSI-424: otro dia sin operaciones devuelve la lista vacia", async () => {
  const r = await listarUltimasOperaciones({ fecha: "2000-01-01", cajero_id: CAJERO });
  assert.deepEqual(r.cajeros, []);
});

test("TDSI-424: valida fecha, limite y largo de los filtros", async () => {
  for (const filtros of [{ fecha: "2026-02-31" }, { fecha: "ayer" }, { limite: 0 }, { limite: 21 }, { limite: "abc" }, { caja_id: "x".repeat(61) }]) {
    await assert.rejects(() => listarUltimasOperaciones(filtros), (e) => e.status === 400, JSON.stringify(filtros));
  }
});


// Estado de CAJERO hasta aqui: 7 aprobadas (10+5+11+12+13+14+15 = 80), 1 anulada (21),
// 1 rechazada (22), 1 pendiente (23). CAJERO_2: 1 mixta aprobada de 30.

test("TDSI-425: resumen por cajero: cantidad, total aprobado y ultima operacion", async () => {
  const r = await obtenerResumenPorCajero({ cajero_id: CAJERO });
  assert.equal(r.cajeros.length, 1);
  const c = r.cajeros[0];
  assert.equal(c.cajero_id, CAJERO);
  assert.equal(c.caja_id, CAJA);
  assert.equal(c.cantidad_operaciones, 10);
  assert.equal(c.cantidad_aprobadas, 7);
  assert.equal(c.cantidad_anuladas, 1);
  assert.equal(c.cantidad_rechazadas, 1);
  assert.equal(c.cantidad_pendientes, 1);
  assert.equal(c.total, 80, "solo suma lo APROBADO");
  assert.equal(c.ultima_operacion.monto, 23);
  assert.equal(c.ultima_operacion.estado, "PENDIENTE");
  assert.match(c.ultima_operacion.hora, /^\d{2}:\d{2}:\d{2}$/);
});

test("TDSI-425: la ultima operacion cambia en vivo al registrar una venta nueva", async () => {
  const { pago } = await registrarPagoSimple({ metodo: "Tarjeta", monto: 9.9, caja_id: CAJA, cajero: CAJERO });
  const c = (await obtenerResumenPorCajero({ cajero_id: CAJERO })).cajeros[0];
  assert.equal(c.ultima_operacion.id_transaccion, pago.id_transaccion);
  assert.deepEqual(c.ultima_operacion.metodos, ["Tarjeta"]);
  assert.equal(c.cantidad_operaciones, 11);
  assert.equal(c.total, 89.9);
});

test("TDSI-425: el pago mixto cuenta como una operacion; totales de todos los cajeros filtrados", async () => {
  const c2 = (await obtenerResumenPorCajero({ caja_id: CAJA_2 })).cajeros[0];
  assert.equal(c2.cajero_id, CAJERO_2);
  assert.equal(c2.cantidad_operaciones, 1);
  assert.equal(c2.total, 30);

  const dos = await obtenerResumenPorCajero({});
  const nuestros = dos.cajeros.filter((c) => [CAJERO, CAJERO_2].includes(c.cajero_id));
  assert.equal(nuestros.length, 2);
  assert.equal(dos.totales.cajeros, dos.cajeros.length);
});

test("TDSI-425: un dia sin operaciones devuelve resumen vacio con totales en 0", async () => {
  const r = await obtenerResumenPorCajero({ fecha: "2000-01-01", cajero_id: CAJERO });
  assert.deepEqual(r.cajeros, []);
  assert.deepEqual(r.totales, { cajeros: 0, cantidad_operaciones: 0, total: 0 });
  await assert.rejects(() => obtenerResumenPorCajero({ fecha: "2026-13-01" }), (e) => e.status === 400);
});