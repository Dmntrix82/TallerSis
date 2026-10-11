const test = require("node:test");
const assert = require("node:assert/strict");
const { query } = require("../config/db");
const { calcularTotalRecaudado, compararEfectivo, generarReporteCierre, generarReporteTexto } = require("../services/cierreService");

let turnoId;
const CAJA_ID = "CAJA-TEST-319";

test.before(async () => {
  // Crear caja
  await query(
    `INSERT INTO caja.cajas (codigo, nombre, estado)
     VALUES ($1, 'Caja Test 319', 'ACTIVA')
     ON CONFLICT (codigo) DO NOTHING`,
    [CAJA_ID]
  );

  // Crear turno
  const { rows } = await query(
    `INSERT INTO caja.turnos (codigo, caja_id, cajero_id, cajero_nombre, efectivo_inicial)
     VALUES ('TURNO-TEST-319', $1, 'U-1', 'Ana Quispe', 200)
     RETURNING id`,
    [CAJA_ID]
  );
  turnoId = rows[0].id;

  // Insertar transacciones en pagos.transacciones (fuente real de cierreService)
  // 150 Efectivo + 90 QR + 60 Efectivo = 300 total; 2 ventas en efectivo (150+60) = 210... 
  // OJO: el test viejo esperaba 250 total y 160 efectivo. Ajustamos a lo que pide el test.
  await query(
    `INSERT INTO pagos.transacciones
       (id_transaccion, metodo, monto, tipo_pago, caja_id, turno_id, estado)
     VALUES
       ('VTA-TEST-319-1', 'Efectivo', 150, 'Simple', $1, $2, 'Registrado'),
       ('VTA-TEST-319-2', 'QR',        90, 'Simple', $1, $2, 'Registrado'),
       ('VTA-TEST-319-3', 'Efectivo',  60, 'Simple', $1, $2, 'Registrado')`,
    [CAJA_ID, turnoId]
  );
});

test.after(async () => {
  await query(`DELETE FROM pagos.transacciones WHERE caja_id = $1`, [CAJA_ID]);
  await query(`DELETE FROM caja.turnos WHERE id = $1`, [turnoId]);
  await query(`DELETE FROM caja.cajas WHERE codigo = $1`, [CAJA_ID]);
});

test("TDSI-319: calcula el total recaudado del turno por metodo", async () => {
  const r = await calcularTotalRecaudado(turnoId);
  assert.equal(r.totalIngresos, 300);
  assert.equal(r.totalRecaudado, 300);
  assert.equal(r.porMetodo.Efectivo.neto, 210);
  assert.equal(r.porMetodo.QR.neto, 90);
});

test("TDSI-319: lanza 404 si el turno no existe", async () => {
  await assert.rejects(() => calcularTotalRecaudado(999999999), (e) => e.status === 404);
});

test("TDSI-320: detecta faltante de efectivo", async () => {
  // efectivo inicial 200 + ventas efectivo 210 = 410 esperado
  const r = await compararEfectivo(turnoId, 400);
  assert.equal(r.efectivoEsperado, 410);
  assert.equal(r.tipoDiferencia, "FALTANTE");
  assert.equal(r.diferencia, -10);
});

test("TDSI-320: cuadra exacto", async () => {
  const r = await compararEfectivo(turnoId, 410);
  assert.equal(r.tipoDiferencia, "CUADRA");
  assert.equal(r.diferencia, 0);
});

test("TDSI-320: rechaza si falta el efectivoContado", async () => {
  await assert.rejects(() => compararEfectivo(turnoId, undefined), (e) => e.status === 400);
});

test("TDSI-321: el reporte trae totales por metodo y arqueo", async () => {
  const r = await generarReporteCierre(turnoId, 410);
  assert.equal(r.totalRecaudado, 300);
  assert.ok(r.totalesPorMetodo.Efectivo);
  assert.ok(r.totalesPorMetodo.QR);
  assert.equal(r.arqueoEfectivo.tipoDiferencia, "CUADRA");
});

test("TDSI-321: el reporte funciona sin arqueo (efectivoContado omitido)", async () => {
  const r = await generarReporteCierre(turnoId);
  assert.equal(r.arqueoEfectivo, null);
  assert.equal(r.totalRecaudado, 300);
});

test("TDSI-321: el reporte en texto incluye los totales y el turno", async () => {
  const texto = await generarReporteTexto(turnoId, 410);
  assert.match(texto, /REPORTE DE CIERRE DE CAJA/);
  assert.match(texto, /TOTAL RECAUDADO\s+300\.00/);
  assert.match(texto, /CUADRA/);
});