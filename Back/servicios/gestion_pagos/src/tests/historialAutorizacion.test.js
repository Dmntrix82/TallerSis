// TDSI-62/956: GET /api/pagos/historial-cajeros devuelve "pedido_por" (siempre) y
// "autorizado_por" (solo en las anulaciones, con el nombre del supervisor que la
// autorizo -- no solo su codigo). BD real + facturacion (FACTURACION_URL) para
// anular de verdad; limpia lo que crea.
const test = require("node:test");
const assert = require("node:assert/strict");
const { pool } = require("../config/db");
const { registrarPagoSimple } = require("../services/pagoSimpleService");
const { anularVenta } = require("../services/ventasCajeroService");
const { consultarHistorial } = require("../services/historialCajerosService");
const { hoyLocal } = require("../utils/fechaLocal");

const CAJERO = `test.hist956.${Date.now()}@tallersis.bo`;
const SUPERVISOR = { supervisor_id: "SUP-TEST", pin: "1234" };

test.after(async () => {
  await pool.query("DELETE FROM pagos.transacciones WHERE cajero = $1", [CAJERO]);
});

test("TDSI-956: la operacion anulada muestra quien la pidio y que supervisor la autorizo (nombre)", async () => {
  const pago = (await registrarPagoSimple({ metodo: "Efectivo", monto: 15, cajero: CAJERO, caja_id: "CAJA-956" })).pago;
  await anularVenta({ id_transaccion: pago.id_transaccion, cajero: CAJERO, ...SUPERVISOR });

  const hoy = hoyLocal();
  const r = await consultarHistorial({ cajero_id: CAJERO, fecha: hoy, por_pagina: 50 });
  const fila = r.operaciones.find((o) => o.id_transaccion === pago.id_transaccion);

  assert.ok(fila, "la venta anulada debe aparecer en el historial");
  assert.equal(fila.estado, "ANULADA");
  assert.equal(fila.pedido_por, CAJERO);
  assert.equal(fila.autorizado_por, "Supervisor Prueba");
});

test("TDSI-956: una operacion que no necesito autorizacion no tiene 'autorizado_por'", async () => {
  const pago = (await registrarPagoSimple({ metodo: "QR", monto: 22, cajero: CAJERO, caja_id: "CAJA-956" })).pago;

  const hoy = hoyLocal();
  const r = await consultarHistorial({ cajero_id: CAJERO, fecha: hoy, por_pagina: 50 });
  const fila = r.operaciones.find((o) => o.id_transaccion === pago.id_transaccion);

  assert.ok(fila);
  assert.equal(fila.estado, "APROBADA");
  assert.equal(fila.pedido_por, CAJERO);
  assert.equal(fila.autorizado_por, null);
});

// TDSI-957
test("TDSI-957: filtra el historial por el supervisor que autorizo", async () => {
  const anulada = (await registrarPagoSimple({ metodo: "Tarjeta", monto: 18, cajero: CAJERO, caja_id: "CAJA-956" })).pago;
  await anularVenta({ id_transaccion: anulada.id_transaccion, cajero: CAJERO, ...SUPERVISOR });
  const normal = (await registrarPagoSimple({ metodo: "Tarjeta", monto: 9, cajero: CAJERO, caja_id: "CAJA-956" })).pago;

  const hoy = hoyLocal();
  const r = await consultarHistorial({ cajero_id: CAJERO, fecha: hoy, supervisor_id: "SUP-TEST", por_pagina: 50 });

  assert.ok(r.operaciones.some((o) => o.id_transaccion === anulada.id_transaccion));
  assert.ok(!r.operaciones.some((o) => o.id_transaccion === normal.id_transaccion));
  assert.ok(r.operaciones.every((o) => o.autorizado_por === "Supervisor Prueba"));
  assert.equal(r.filtros.supervisor_id, "SUP-TEST");
});

test("TDSI-957: un supervisor sin anulaciones en el rango devuelve la lista vacia", async () => {
  const hoy = hoyLocal();
  const r = await consultarHistorial({ cajero_id: CAJERO, fecha: hoy, supervisor_id: "SUP-NO-EXISTE", por_pagina: 50 });
  assert.equal(r.operaciones.length, 0);
});
