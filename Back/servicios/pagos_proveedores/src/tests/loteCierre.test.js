// TDSI-417: usa la base real en MODO_AISLADO (ingresos simulados) con una fecha
// antigua reservada para pruebas, y la limpia al terminar.
process.env.MODO_AISLADO = "true";

const test = require("node:test");
const assert = require("node:assert/strict");
const { generarLote } = require("../services/loteCierreService");
const { pool } = require("../config/db");

const FECHA = "2000-01-03";
const borrarLote = () => pool.query("DELETE FROM proveedores.lotes_cierre_diario WHERE fecha = $1", [FECHA]);

test.beforeEach(borrarLote);
test.after(async () => {
  await borrarLote();
  await pool.end();
});

test("TDSI-417: guarda el lote GENERADO con sus totales", async () => {
  const lote = await generarLote({ fecha: FECHA, generado_por: "admin.prueba" });
  assert.equal(lote.fecha, FECHA);
  assert.equal(lote.estado, "GENERADO");
  assert.equal(lote.generado_por, "admin.prueba");
  assert.equal(lote.total_ingresos, 1500);
  assert.equal(lote.total_impuestos, 195);
  assert.equal(lote.total_neto, lote.total_ingresos - lote.total_egresos - lote.total_impuestos);
  assert.equal(lote.modo_aislado, true);
});

test("TDSI-417: no duplica la fecha y devuelve el lote existente en el 409", async () => {
  const primero = await generarLote({ fecha: FECHA, generado_por: "admin.prueba" });
  await assert.rejects(
    () => generarLote({ fecha: FECHA, generado_por: "otro.admin" }),
    (e) => e.status === 409 && e.detalle.lote.id === primero.id && e.detalle.lote.generado_por === "admin.prueba"
  );
});

test("TDSI-417: dos solicitudes al mismo tiempo generan un solo lote", async () => {
  const r = await Promise.allSettled([
    generarLote({ fecha: FECHA, generado_por: "a" }),
    generarLote({ fecha: FECHA, generado_por: "b" }),
  ]);
  assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(r.find((x) => x.status === "rejected").reason.status, 409);
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM proveedores.lotes_cierre_diario WHERE fecha = $1", [FECHA]);
  assert.equal(rows[0].n, 1);
});

test("TDSI-417: convierte la fila EN_CURSO del flujo de egresos (TDSI-401) en el lote", async () => {
  await pool.query(
    "INSERT INTO proveedores.lotes_cierre_diario (fecha, total_egresos, estado) VALUES ($1, 999, 'EN_CURSO')",
    [FECHA]
  );
  const lote = await generarLote({ fecha: FECHA, generado_por: "admin.prueba" });
  assert.equal(lote.estado, "GENERADO");
  // los totales se recalculan desde proveedores.egresos, no se arrastra el acumulado
  assert.notEqual(lote.total_egresos, 999);
});

test("TDSI-417: exige generado_por", async () => {
  for (const generado_por of [undefined, "", "   ", "x".repeat(61)]) {
    await assert.rejects(() => generarLote({ fecha: FECHA, generado_por }), (e) => e.status === 400);
  }
});