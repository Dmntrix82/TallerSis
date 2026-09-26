const test = require("node:test");
const assert = require("node:assert/strict");
const { query } = require("../config/db");
const { calcularTotalRecaudado, compararEfectivo, generarReporteCierre, generarReporteTexto } = require("../services/cierreService");

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

test("TDSI-320: detecta faltante de efectivo", async () => {
  const r = await compararEfectivo(turnoId, 350);
  assert.equal(r.efectivoEsperado, 360);
  assert.equal(r.tipoDiferencia, "FALTANTE");
  assert.equal(r.diferencia, -10);
});

test("TDSI-320: cuadra exacto", async () => {
  const r = await compararEfectivo(turnoId, 360);
  assert.equal(r.tipoDiferencia, "CUADRA");
  assert.equal(r.diferencia, 0);
});

test("TDSI-320: rechaza si falta el efectivoContado", async () => {
  await assert.rejects(() => compararEfectivo(turnoId, undefined), (e) => e.status === 400);
});

test("TDSI-321: el reporte trae totales por metodo y arqueo", async () => {
  const r = await generarReporteCierre(turnoId, 360);
  assert.equal(r.totalRecaudado, 250);
  assert.ok(r.totalesPorMetodo.Efectivo);
  assert.ok(r.totalesPorMetodo.QR);
  assert.equal(r.arqueoEfectivo.tipoDiferencia, "CUADRA");
});

test("TDSI-321: el reporte funciona sin arqueo (efectivoContado omitido)", async () => {
  const r = await generarReporteCierre(turnoId);
  assert.equal(r.arqueoEfectivo, null);
  assert.equal(r.totalRecaudado, 250);
});

test("TDSI-321: el reporte en texto incluye los totales y el turno", async () => {
  const texto = await generarReporteTexto(turnoId, 360);
  assert.match(texto, /REPORTE DE CIERRE DE CAJA/);
  assert.match(texto, /TOTAL RECAUDADO\s+250\.00/);
  assert.match(texto, /CUADRA/);
});