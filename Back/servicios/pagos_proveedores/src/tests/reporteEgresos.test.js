// TDSI-22: el lote guarda el detalle de cada egreso del dia y el reporte lo envia con su cuadre.
// Usa la base real en MODO_AISLADO con una fecha reservada para pruebas; todo se borra al final.
process.env.MODO_AISLADO = "true";
process.env.PUBSUB_TOPIC = "";

const test = require("node:test");
const assert = require("node:assert/strict");
const { generarLote } = require("../services/loteCierreService");
const { armarReporte } = require("../services/reporteContabilidadService");
const { pool } = require("../config/db");

const FECHA = "2000-01-06";
const borrar = async () => {
  await pool.query("DELETE FROM proveedores.lotes_cierre_diario WHERE fecha = $1", [FECHA]);
  await pool.query("DELETE FROM proveedores.egresos WHERE orden_pago_id IN (SELECT id FROM proveedores.ordenes_pago WHERE orden_compra_id LIKE 'OC-TEST-2000-%')");
  await pool.query("DELETE FROM proveedores.ordenes_pago WHERE orden_compra_id LIKE 'OC-TEST-2000-%'");
};

test.before(async () => {
  await borrar();
  const { rows } = await pool.query(
    `INSERT INTO proveedores.ordenes_pago
       (numero, orden_compra_id, proveedor_nit, proveedor_razon_social, proveedor_cuenta_bancaria, proveedor_banco, monto, concepto, estado)
     VALUES ('OP-T20000106', 'OC-TEST-2000-1', '1029384756', 'Distribuidora Andina S.A.', '100200300', 'Banco Union', 300, 'Compra de insumos', 'LIQUIDADA')
     RETURNING id`
  );
  await pool.query(
    `INSERT INTO proveedores.egresos (orden_pago_id, monto, metodo, descripcion, registrado_por, registrado_en) VALUES
       ($1, 250, 'TRANSFERENCIA', NULL, 'admin', '2000-01-06 10:00:00-04'),
       ($1,  50, 'EFECTIVO', 'Saldo en efectivo', 'admin', '2000-01-06 22:30:00-04'),
       ($1,  99, 'EFECTIVO', 'Otro dia', 'admin', '2000-01-07 00:30:00-04')`,
    [rows[0].id]
  );
});
test.after(async () => {
  await borrar();
  await pool.end();
});

test("TDSI-22: el reporte trae cada egreso del dia (hora de Bolivia) con su proveedor y cuadra con el total", async () => {
  const lote = await generarLote({ fecha: FECHA, generado_por: "admin.prueba" });
  const r = armarReporte(lote);

  assert.equal(r.egresos.total, 300);
  assert.equal(r.egresos.detalle.length, 2); // el de las 00:30 del dia siguiente no entra
  assert.deepEqual(
    r.egresos.detalle.map((e) => [e.orden_pago, e.metodo, e.monto, e.concepto]),
    [["OP-T20000106", "TRANSFERENCIA", 250, "Compra de insumos"], ["OP-T20000106", "EFECTIVO", 50, "Saldo en efectivo"]]
  );
  assert.deepEqual(r.egresos.detalle[0].proveedor, { nit: "1029384756", razon_social: "Distribuidora Andina S.A." });
  assert.equal(r.cuadre.egresos_cuadra, true);
  assert.equal(r.cuadre.ingresos_cuadra, true);
  assert.equal(r.cuadre.neto_cuadra, true);
});
