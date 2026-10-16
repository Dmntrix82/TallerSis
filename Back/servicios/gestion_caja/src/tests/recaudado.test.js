const test = require("node:test");
const assert = require("node:assert/strict");
const { query } = require("../config/db");
const { calcularRecaudadoPorCaja } = require("../services/recaudadoService");

const CAJA_A = "CAJA-TEST-REC-1";
const CAJA_B = "CAJA-TEST-REC-2";

test.before(async () => {
  // Crear cajas
  await query(
    `INSERT INTO caja.cajas (codigo, nombre, estado)
     VALUES ($1, 'Caja Test Rec 1', 'ACTIVA'), ($2, 'Caja Test Rec 2', 'ACTIVA')
     ON CONFLICT (codigo) DO NOTHING`,
    [CAJA_A, CAJA_B]
  );

  // Insertar transacciones en pagos.transacciones para CAJA_A
  await query(
    `INSERT INTO pagos.transacciones
       (id_transaccion, metodo, monto, tipo_pago, caja_id, estado)
     VALUES
       ('VTA-REC-A-1', 'Efectivo', 100, 'Simple', $1, 'Registrado'),
       ('VTA-REC-A-2', 'Tarjeta',  200, 'Simple', $1, 'Registrado'),
       ('VTA-REC-A-3', 'Efectivo', 50,  'Simple', $1, 'Registrado')`,
    [CAJA_A]
  );

  // Insertar transacciones para CAJA_B
  await query(
    `INSERT INTO pagos.transacciones
       (id_transaccion, metodo, monto, tipo_pago, caja_id, estado)
     VALUES
       ('VTA-REC-B-1', 'QR', 30, 'Simple', $1, 'Registrado')`,
    [CAJA_B]
  );
});

test.after(async () => {
  await query(`DELETE FROM pagos.transacciones WHERE caja_id IN ($1, $2)`, [CAJA_A, CAJA_B]);
  await query(`DELETE FROM caja.cajas WHERE codigo IN ($1, $2)`, [CAJA_A, CAJA_B]);
});

test("TDSI-479: total recaudado por caja (una sola caja)", async () => {
  const r = await calcularRecaudadoPorCaja({ caja_id: CAJA_A });
  assert.equal(r.caja_id, CAJA_A);
  assert.equal(r.totalIngresos, 350);
  assert.equal(r.totalRecaudado, 350);
  assert.equal(r.porMetodo.Efectivo.ingresos, 150);
  assert.equal(r.porMetodo.Tarjeta.ingresos, 200);
  assert.equal(r.porMetodo.QR.ingresos, 0);
});

test("TDSI-480: los egresos son 0 y el neto es igual a los ingresos", async () => {
  const r = await calcularRecaudadoPorCaja({ caja_id: CAJA_A });
  assert.equal(r.totalEgresos, 0);
  assert.equal(r.totalRecaudado, r.totalIngresos);
  assert.equal(r.porMetodo.Efectivo.egresos, 0);
  assert.equal(r.porMetodo.Efectivo.neto, r.porMetodo.Efectivo.ingresos);
});

test("TDSI-479: total recaudado de todas las cajas activas (sin caja_id)", async () => {
  const r = await calcularRecaudadoPorCaja({});
  assert.ok(Array.isArray(r));
  const cajaA = r.find((c) => c.caja_id === CAJA_A);
  const cajaB = r.find((c) => c.caja_id === CAJA_B);
  assert.ok(cajaA);
  assert.ok(cajaB);
  assert.equal(cajaA.totalRecaudado, 350);
  assert.equal(cajaB.totalRecaudado, 30);
});

test("TDSI-481: acepta rango de fechas (desde, hasta)", async () => {
  // Rango antiguo → sin resultados
  const r = await calcularRecaudadoPorCaja({
    caja_id: CAJA_A,
    desde: "2020-01-01",
    hasta: "2020-12-31",
  });
  assert.equal(r.totalRecaudado, 0);
});

test("TDSI-481: rechaza si 'desde' no es una fecha válida", async () => {
  await assert.rejects(
    () => calcularRecaudadoPorCaja({ caja_id: CAJA_A, desde: "no-es-fecha" }),
    (e) => e.status === 400
  );
});

test("TDSI-481: rechaza si 'desde' es mayor que 'hasta'", async () => {
  await assert.rejects(
    () => calcularRecaudadoPorCaja({ caja_id: CAJA_A, desde: "2026-12-31", hasta: "2026-01-01" }),
    (e) => e.status === 400
  );
});

test("TDSI-479: lanza 404 si la caja no existe", async () => {
  await assert.rejects(
    () => calcularRecaudadoPorCaja({ caja_id: "CAJA-NO-EXISTE" }),
    (e) => e.status === 404
  );
});