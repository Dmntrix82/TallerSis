// TDSI-23: monitoreo de operaciones de cajeros (usa la BD real; limpia lo que crea).
const test = require("node:test");
const assert = require("node:assert/strict");
const { pool } = require("../config/db");
const { registrarPagoSimple } = require("../services/pagoSimpleService");
const { registrarPagoMixto } = require("../services/pagoMixtoService");
const { listarUltimasOperaciones } = require("../services/monitoreoService");

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