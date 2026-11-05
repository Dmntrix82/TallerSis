const test = require("node:test");
const assert = require("node:assert/strict");
const { query } = require("../config/db");
const { detectarPosibleDuplicado } = require("../services/duplicadoService");

const CAJERO_ID = "CAJERO-TEST";
const NIT = "1234567";
const TOTAL = 150;

// Función para limpiar la BD antes de cada prueba
async function limpiar() {
  await query(`DELETE FROM pagos.transacciones WHERE cajero_id = $1`, [CAJERO_ID]);
}

test.beforeEach(async () => {
  await limpiar();
});

test.after(async () => {
  await limpiar();
});

test("TDSI-828: detecta un cobro repetido dentro de los 2 minutos", async () => {
  await query(
    `INSERT INTO pagos.transacciones (id_transaccion, metodo, monto, tipo_pago, nit, cajero_id, estado)
     VALUES ('VTA-TEST-1', 'Efectivo', $1, 'Simple', $2, $3, 'Registrado')`,
    [TOTAL, NIT, CAJERO_ID]
  );

  const res = await detectarPosibleDuplicado({ cajero_id: CAJERO_ID, nit: NIT, total: TOTAL });
  assert.equal(res.esDuplicado, true);
  assert.equal(res.factura, "VTA-TEST-1");
  assert.ok(res.segundos <= 120);
});

test("TDSI-828: NO detecta duplicado si la venta fue hace más de 2 minutos", async () => {
  await query(
    `INSERT INTO pagos.transacciones (id_transaccion, metodo, monto, tipo_pago, nit, cajero_id, estado, fecha)
     VALUES ('VTA-TEST-2', 'Efectivo', $1, 'Simple', $2, $3, 'Registrado', now() - interval '5 minutes')`,
    [TOTAL, NIT, CAJERO_ID]
  );

  const res = await detectarPosibleDuplicado({ cajero_id: CAJERO_ID, nit: NIT, total: TOTAL });
  assert.equal(res.esDuplicado, false);
});

test("TDSI-827: NO detecta duplicado si la venta está anulada", async () => {
  await query(
    `INSERT INTO pagos.transacciones (id_transaccion, metodo, monto, tipo_pago, nit, cajero_id, estado)
     VALUES ('VTA-TEST-3', 'Efectivo', $1, 'Simple', $2, $3, 'Anulado')`,
    [TOTAL, NIT, CAJERO_ID]
  );

  const res = await detectarPosibleDuplicado({ cajero_id: CAJERO_ID, nit: NIT, total: TOTAL });
  assert.equal(res.esDuplicado, false);
});