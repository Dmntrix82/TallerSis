const test = require("node:test");
const assert = require("node:assert/strict");
const { query } = require("../config/db");
const { calcularTotalRecaudado } = require("../services/cierreService");

let turnoId;

test.before(async () => {
  const { rows } = await query(
    `INSERT INTO caja.turnos (codigo, caja_id, cajero_id, cajero_nombre, efectivo_inicial)
     VALUES ('TURNO-TEST-319', 'CAJA-TEST', 'U-1', 'Ana Quispe', 200)
     RETURNING id`
  );
  turnoId = rows[0].id;

  await query(
    `INSERT INTO caja.movimientos (caja_id, turno_id, tipo, metodo, monto, descripcion) VALUES
     ('CAJA-TEST', $1, 'INGRESO', 'Efectivo', 150, 'Venta 1'),
     ('CAJA-TEST', $1, 'INGRESO', 'QR', 90, 'Venta 1'),
     ('CAJA-TEST', $1, 'INGRESO', 'Efectivo', 60, 'Venta 2'),
     ('CAJA-TEST', $1, 'EGRESO', 'Efectivo', 50, 'Pago proveedor')`,
    [turnoId]
  );
});

test.after(async () => {
  await query(`DELETE FROM caja.turnos WHERE id = $1`, [turnoId]);
});

test("TDSI-319: calcula el total recaudado del turno por metodo", async () => {
  const r = await calcularTotalRecaudado(turnoId);
  assert.equal(r.totalIngresos, 300);
  assert.equal(r.totalEgresos, 50);
  assert.equal(r.totalRecaudado, 250);
  assert.equal(r.porMetodo.Efectivo.neto, 160);
  assert.equal(r.porMetodo.QR.neto, 90);
});

test("TDSI-319: lanza 404 si el turno no existe", async () => {
  await assert.rejects(() => calcularTotalRecaudado(999999999), (e) => e.status === 404);
});