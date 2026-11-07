// TDSI-59/906: vista previa de la factura antes del PIN del supervisor
// (GET /api/pagos/:id_transaccion/resumen-autorizacion). Usa la BD real y limpia lo que crea.
// Las solicitudes y la bitacora se cargan con SQL directo, para no depender de otros flujos.
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { pool } = require("../config/db");
const { errorHandler } = require("../middlewares/errorHandler");
const { registrarPagoSimple } = require("../services/pagoSimpleService");
const { registrarPagoMixto } = require("../services/pagoMixtoService");
const { obtenerResumenAutorizacion } = require("../services/resumenAutorizacionService");

const SUFIJO = Date.now();
const CAJERO = `test.resumen.${SUFIJO}@tallersis.bo`;
const CAJA = `TEST-RES-${SUFIJO}`;
const CI = String(SUFIJO).slice(-8);

const ventas = {};
let servidor;
let base;

test.before(async () => {
  ventas.mixta = (await registrarPagoMixto({
    cajaId: CAJA, cajero: CAJERO, total: 87.5,
    tipo_documento: "CI", nit: CI, razon_social: "José Pérez",
    metodos: [{ metodo: "Efectivo", monto: 37.5 }, { metodo: "QR", monto: 50 }],
  })).pago;
  ventas.simple = (await registrarPagoSimple({ metodo: "Tarjeta", monto: 40, caja_id: CAJA, cajero: CAJERO })).pago;
  ventas.anulada = (await registrarPagoSimple({ metodo: "Efectivo", monto: 15, caja_id: CAJA, cajero: CAJERO })).pago;
  await pool.query("UPDATE pagos.transacciones SET estado = 'Anulado' WHERE id_transaccion = $1", [ventas.anulada.id_transaccion]);

  const app = express();
  app.use(express.json());
  app.use("/api/pagos", require("../routes/resumenAutorizacionRoutes"));
  app.use(errorHandler);
  await new Promise((ok) => { servidor = app.listen(0, ok); });
  base = `http://localhost:${servidor.address().port}/api/pagos`;
});

test.after(async () => {
  await new Promise((ok) => servidor.close(ok));
  const ids = Object.values(ventas).map((v) => v.id_transaccion);
  await pool.query("DELETE FROM pagos.solicitudes_anulacion WHERE id_transaccion = ANY($1)", [ids]);
  await pool.query("DELETE FROM pagos.bitacora_modificaciones WHERE id_transaccion = ANY($1)", [ids]);
  await pool.query("DELETE FROM pagos.transacciones WHERE cajero = $1", [CAJERO]);
  await pool.query("DELETE FROM pagos.pagos_mixtos WHERE caja_id = $1", [CAJA]);
  await pool.end();
});

test("TDSI-195/911: el resumen trae N° de factura, cliente, total, metodos y cajero (pago mixto)", async () => {
  const r = await obtenerResumenAutorizacion(ventas.mixta.id_transaccion, { cajero: CAJERO });
  assert.equal(r.numero_factura, ventas.mixta.id_transaccion);
  assert.match(r.numero_factura, /^VTA-\d{6}$/);
  assert.equal(r.cliente, "José Pérez");
  assert.equal(r.tipo_documento, "CI");
  assert.equal(r.nit, CI);
  assert.equal(r.total, 87.5);
  assert.equal(r.tipo_pago, "Mixto");
  assert.deepEqual(r.metodos, ["Efectivo", "QR"]);
  assert.deepEqual(r.detalle_metodos, [{ metodo: "Efectivo", monto: 37.5 }, { metodo: "QR", monto: 50 }]);
  assert.equal(r.cajero, CAJERO);
  assert.equal(r.caja_id, CAJA);
  assert.ok(r.fecha);
});

test("TDSI-195/912: los items traen cantidad, precio y subtotal (sin detalle por producto: 1 item con el total)", async () => {
  const r = await obtenerResumenAutorizacion(ventas.mixta.id_transaccion, { cajero: CAJERO });
  assert.deepEqual(r.items, [{ descripcion: "Venta", cantidad: 1, precio_unitario: 87.5, subtotal: 87.5 }]);
  assert.equal(r.items_detallados, false);
});

test("TDSI-195: una venta sin NIT/CI sale como Consumidor final", async () => {
  const r = await obtenerResumenAutorizacion(ventas.simple.id_transaccion, { cajero: CAJERO });
  assert.equal(r.cliente, "Consumidor final");
  assert.equal(r.nit, null);
  assert.deepEqual(r.metodos, ["Tarjeta"]);
  assert.equal(r.total, 40);
});

test("TDSI-903/913: el resumen trae el motivo de la solicitud de anulacion pendiente", async () => {
  const id = ventas.simple.id_transaccion;
  let r = await obtenerResumenAutorizacion(id, { cajero: CAJERO });
  assert.equal(r.motivo, null);
  assert.equal(r.solicitud, null);

  await pool.query(
    `INSERT INTO pagos.solicitudes_anulacion (id_transaccion, motivo, solicitado_por, estado, solicitado_en)
     VALUES ($1, 'Motivo viejo ya resuelto', $2, 'Rechazada', now() - interval '1 hour'),
            ($1, 'El cliente pago dos veces', $2, 'Solicitada', now())`,
    [id, CAJERO]
  );
  r = await obtenerResumenAutorizacion(id, { cajero: CAJERO });
  assert.equal(r.motivo, "El cliente pago dos veces");
  assert.equal(r.solicitud.solicitado_por, CAJERO);
  assert.ok(r.solicitud.solicitado_en);
});

test("TDSI-904/914: el resumen trae los datos actuales y las modificaciones anteriores", async () => {
  const id = ventas.mixta.id_transaccion;
  let r = await obtenerResumenAutorizacion(id, { cajero: CAJERO });
  assert.deepEqual(r.datos_actuales, { tipo_documento: "CI", nit: CI, razon_social: "José Pérez", telefono: null });
  assert.deepEqual(r.modificaciones_anteriores, []);

  await pool.query("UPDATE pagos.transacciones SET razon_social = 'José Pérez Ríos' WHERE id_transaccion = $1", [id]);
  await pool.query(
    `INSERT INTO pagos.bitacora_modificaciones (id_transaccion, campo, valor_anterior, valor_nuevo, modificado_por, autorizado_por)
     VALUES ($1, 'razon_social', 'José Pérez', 'José Pérez Ríos', $2, 'SUP-TEST')`,
    [id, CAJERO]
  );
  r = await obtenerResumenAutorizacion(id, { cajero: CAJERO });
  assert.equal(r.datos_actuales.razon_social, "José Pérez Ríos");
  assert.equal(r.modificaciones_anteriores.length, 1);
  assert.equal(r.modificaciones_anteriores[0].campo, "razon_social");
  assert.equal(r.modificaciones_anteriores[0].valor_anterior, "José Pérez");
  assert.equal(r.modificaciones_anteriores[0].valor_nuevo, "José Pérez Ríos");
});

test("TDSI-905: 404 con mensaje claro si la factura no existe o ya esta anulada", async () => {
  await assert.rejects(() => obtenerResumenAutorizacion("VTA-999999999", { cajero: CAJERO }), (e) => e.status === 404 && /no existe/.test(e.message));
  await assert.rejects(
    () => obtenerResumenAutorizacion(ventas.anulada.id_transaccion, { cajero: CAJERO }),
    (e) => e.status === 404 && /ya esta anulada/.test(e.message)
  );
  await assert.rejects(() => obtenerResumenAutorizacion("   ", { cajero: CAJERO }), { status: 400 });
  await assert.rejects(() => obtenerResumenAutorizacion("X".repeat(61), { cajero: CAJERO }), { status: 400 });
});

test("TDSI-906: GET /api/pagos/:id_transaccion/resumen-autorizacion por HTTP", async () => {
  let r = await fetch(`${base}/${ventas.mixta.id_transaccion}/resumen-autorizacion?cajero=${encodeURIComponent(CAJERO)}`);
  assert.equal(r.status, 200);
  const { ok, data } = await r.json();
  assert.equal(ok, true);
  assert.equal(data.numero_factura, ventas.mixta.id_transaccion);
  assert.equal(data.items.length, 1);

  r = await fetch(`${base}/${ventas.anulada.id_transaccion}/resumen-autorizacion?cajero=${encodeURIComponent(CAJERO)}`);
  assert.equal(r.status, 404);
  const error = await r.json();
  assert.equal(error.ok, false);
  assert.match(error.mensaje, /ya esta anulada/);
});
