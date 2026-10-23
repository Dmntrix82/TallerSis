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

test("TDSI-481: un solo dia (desde = hasta) cuenta todo el dia en hora de Bolivia", async () => {
  // Ventas de un dia fijo: 08:00 y 22:30 hora de Bolivia (la de las 22:30 ya es el dia
  // siguiente en UTC). Antes, desde=hasta daba 0 y la de la noche se perdia.
  const DIA = "2021-07-15";
  await query(
    `INSERT INTO pagos.transacciones (id_transaccion, metodo, monto, tipo_pago, caja_id, estado, fecha) VALUES
       ('VTA-REC-B-DIA-1', 'Efectivo', 40, 'Simple', $1, 'Registrado', ($2::date + time '08:00')::timestamp AT TIME ZONE 'America/La_Paz'),
       ('VTA-REC-B-DIA-2', 'QR',       25, 'Simple', $1, 'Registrado', ($2::date + time '22:30')::timestamp AT TIME ZONE 'America/La_Paz')`,
    [CAJA_B, DIA]
  );
  const r = await calcularRecaudadoPorCaja({ caja_id: CAJA_B, desde: DIA, hasta: DIA });
  assert.equal(r.desde, DIA);
  assert.equal(r.hasta, DIA);
  assert.equal(r.totalRecaudado, 65);
  assert.equal(r.porMetodo.QR.ingresos, 25);

  const soloDesde = await calcularRecaudadoPorCaja({ caja_id: CAJA_B, desde: DIA });
  assert.equal(soloDesde.totalRecaudado, 65);
  const diaSiguiente = await calcularRecaudadoPorCaja({ caja_id: CAJA_B, desde: "2021-07-16", hasta: "2021-07-16" });
  assert.equal(diaSiguiente.totalRecaudado, 0);
});

test("TDSI-481: rechaza si 'desde' no es una fecha válida", async () => {
  await assert.rejects(
    () => calcularRecaudadoPorCaja({ caja_id: CAJA_A, desde: "no-es-fecha" }),
    (e) => e.status === 400
  );
});

test("TDSI-481: rechaza fechas que no son YYYY-MM-DD o no existen", async () => {
  for (const desde of ["2026-02-30", "18/10/2026", "2026-10-18T10:00:00Z"]) {
    await assert.rejects(() => calcularRecaudadoPorCaja({ caja_id: CAJA_A, desde }), (e) => e.status === 400, desde);
  }
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