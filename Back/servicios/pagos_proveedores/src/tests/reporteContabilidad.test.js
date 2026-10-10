const test = require("node:test");
const assert = require("node:assert/strict");
const { armarReporte } = require("../services/reporteContabilidadService");

const loteBase = () => ({
  id: "8",
  fecha: "2026-10-09",
  total_ingresos: 500,
  total_egresos: 120,
  total_impuestos: 65,
  total_neto: 315,
  iva_porcentaje: 13,
  estado: "GENERADO",
  modo_aislado: false,
  generado_por: "jose",
  generado_en: new Date("2026-10-09T23:00:00Z"),
  detalle: {
    ingresos: { efectivo: 300, tarjeta: 200, qr: 0, total: 500, cantidadVentas: 4, cantidadAnuladas: 1, montoAnulado: 20 },
    egresos: { total: 120, cantidad: 1, porMetodo: [{ metodo: "TRANSFERENCIA", total: 120, cantidad: 1 }] },
    periodoContable: { disponible: true, periodo: "2026-10", abierto: true },
  },
});

test("TDSI-419: arma el reporte con ingresos, egresos, impuestos y neto del lote", () => {
  const r = armarReporte(loteBase(), { emitidoEn: new Date("2026-10-10T12:00:00Z") });
  assert.equal(r.tipo, "REPORTE_CIERRE_DIARIO");
  assert.equal(r.lote_id, 8);
  assert.equal(r.fecha, "2026-10-09");
  assert.equal(r.periodo, "2026-10");
  assert.deepEqual(r.ingresos, {
    total: 500, efectivo: 300, tarjeta: 200, qr: 0, cantidad_ventas: 4, cantidad_anuladas: 1, monto_anulado: 20,
  });
  assert.deepEqual(r.egresos, { total: 120, cantidad: 1, por_metodo: [{ metodo: "TRANSFERENCIA", total: 120, cantidad: 1 }] });
  assert.deepEqual(r.impuestos, {
    total: 65, detalle: [{ tipo: "IVA", porcentaje: 13, base_imponible: 500, monto: 65 }],
  });
  assert.equal(r.neto, 315);
  assert.equal(r.datos_simulados, false);
  assert.equal(r.generado_en, "2026-10-09T23:00:00.000Z");
  assert.equal(r.emitido_en, "2026-10-10T12:00:00.000Z");
});

test("TDSI-419: el reporte es JSON serializable y no pierde datos", () => {
  const r = armarReporte(loteBase());
  assert.deepEqual(JSON.parse(JSON.stringify(r)), r);
});

test("TDSI-419: un lote sin detalle (datos viejos) igual arma el reporte con los totales", () => {
  const lote = { ...loteBase(), detalle: null };
  const r = armarReporte(lote);
  assert.equal(r.ingresos.total, 500);
  assert.equal(r.ingresos.efectivo, 0);
  assert.deepEqual(r.egresos.por_metodo, []);
  assert.equal(r.periodo, "2026-10");
});

test("TDSI-419: no arma reporte de un lote inexistente o EN_CURSO", () => {
  assert.throws(() => armarReporte(null), (e) => e.status === 400);
  assert.throws(() => armarReporte({ ...loteBase(), estado: "EN_CURSO" }), (e) => e.status === 409);
});