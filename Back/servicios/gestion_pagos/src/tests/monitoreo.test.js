// TDSI-23: monitoreo de operaciones de cajeros (usa la BD real; limpia lo que crea).
const test = require("node:test");
const assert = require("node:assert/strict");
const { pool } = require("../config/db");
const { registrarPagoSimple } = require("../services/pagoSimpleService");
const { registrarPagoMixto } = require("../services/pagoMixtoService");

const CAJERO = `test.monitoreo.${Date.now()}@tallersis.bo`;
const CAJA = `TEST-MON-${Date.now()}`;

test.after(async () => {
  await pool.query("DELETE FROM pagos.transacciones WHERE cajero = $1 OR cajero_id = $1", [CAJERO]);
  await pool.query("DELETE FROM pagos.pagos_mixtos WHERE caja_id = $1", [CAJA]);
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
    cajaId: CAJA, cajero: CAJERO, total: 30,
    metodos: [{ metodo: "Efectivo", monto: 10 }, { metodo: "Tarjeta", monto: 20 }],
  });
  assert.equal(r.transacciones.length, 2);
  for (const t of r.transacciones) {
    assert.equal(t.cajero_id, CAJERO);
    assert.equal(t.caja_id, CAJA);
  }
});