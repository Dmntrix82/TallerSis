const test = require("node:test");
const assert = require("node:assert/strict");
const { query } = require("../config/db");
const { registrar, obtenerConteoHoy } = require("../services/ventasCanceladasService");

const CAJERO_ID = "CAJERO-CANCEL-TEST";

async function limpiar() {
  await query(`DELETE FROM pagos.ventas_canceladas WHERE cajero_id = $1`, [CAJERO_ID]);
}

test.beforeEach(limpiar);
test.after(limpiar);

test("TDSI-841: registra una venta cancelada con motivo válido", async () => {
  const res = await registrar({
    cajero_id: CAJERO_ID,
    items: [{ nombre: "Producto 1", precio: 10 }],
    total: 10,
    motivo: "El cliente desistió",
  });
  assert.equal(res.cajero_id, CAJERO_ID);
  assert.equal(res.motivo, "El cliente desistió");
  assert.equal(res.total, 10);

  // TDSI-840: Verificamos que NO se creó una transacción en la tabla de ventas
  const { rows } = await query(`SELECT * FROM pagos.transacciones WHERE cajero_id = $1`, [CAJERO_ID]);
  assert.equal(rows.length, 0, "No debe crear ninguna transacción");
});

test("TDSI-841: rechaza motivo inválido", async () => {
  await assert.rejects(
    () => registrar({
      cajero_id: CAJERO_ID,
      items: [{ nombre: "Prod", precio: 10 }],
      total: 10,
      motivo: "Motivo inventado",
    }),
    (e) => e.status === 400
  );
});

test("TDSI-841: exige texto si el motivo es 'Otro'", async () => {
  await assert.rejects(
    () => registrar({
      cajero_id: CAJERO_ID,
      items: [{ nombre: "Prod", precio: 10 }],
      total: 10,
      motivo: "Otro",
    }),
    (e) => e.status === 400
  );
});

test("TDSI-839: cuenta las ventas canceladas hoy", async () => {
  await registrar({
    cajero_id: CAJERO_ID, items: [{ id: 1 }], total: 10, motivo: "Fondos insuficientes",
  });
  await registrar({
    cajero_id: CAJERO_ID, items: [{ id: 2 }], total: 20, motivo: "El cliente desistió",
  });

  const res = await obtenerConteoHoy(CAJERO_ID);
  assert.equal(res.total, 2);
});