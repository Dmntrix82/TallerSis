// TDSI-34: monitoreo por metodo de pago (usa la BD real; limpia lo que crea).
// Las ventas de prueba se mueven a dias fijos de 2021 para que los totales del dia sean exactos
// aunque haya otras ventas en la BD (las de hoy, las semillas, otros tests corriendo a la vez).
const test = require("node:test");
const assert = require("node:assert/strict");
const { pool } = require("../config/db");
const { registrarPagoSimple } = require("../services/pagoSimpleService");
const { monitorearMetodos } = require("../services/metodosPagoService");
const { hoyLocal } = require("../utils/fechaLocal");

const SUFIJO = Date.now();
const CAJERO_A = `test.metodos.a.${SUFIJO}@tallersis.bo`;
const CAJERO_B = `test.metodos.b.${SUFIJO}@tallersis.bo`;
const CAJA_1 = `TEST-MET1-${SUFIJO}`;
const CAJA_2 = `TEST-MET2-${SUFIJO}`;
const D1 = "2021-05-10";
const D2 = "2021-05-11";

/** Mueve una venta a un dia y hora fijos (hora de Bolivia). */
const moverA = (idTransaccion, dia, hora) =>
  pool.query(
    "UPDATE pagos.transacciones SET fecha = ($2::date + $3::time)::timestamp AT TIME ZONE 'America/La_Paz' WHERE id_transaccion = $1",
    [idTransaccion, dia, hora]
  );

const ops = {};

test.before(async () => {
  const simple = async (clave, metodo, monto, cajero, caja, dia, hora) => {
    ops[clave] = (await registrarPagoSimple({ metodo, monto, caja_id: caja, cajero })).pago;
    await moverA(ops[clave].id_transaccion, dia, hora);
  };
  // Dia 1: Efectivo 50 + 30, Tarjeta 100, QR 20 -> 200 cobrado
  await simple("e1", "Efectivo", 50, CAJERO_A, CAJA_1, D1, "09:00");
  await simple("e2", "Efectivo", 30, CAJERO_B, CAJA_2, D1, "10:00");
  await simple("t1", "Tarjeta", 100, CAJERO_A, CAJA_1, D1, "11:00");
  await simple("q1", "QR", 20, CAJERO_B, CAJA_2, D1, "12:00");
  // no suman: una anulada, una rechazada y una pendiente
  await simple("anulada", "Tarjeta", 500, CAJERO_A, CAJA_1, D1, "13:00");
  await simple("rechazada", "QR", 70, CAJERO_B, CAJA_2, D1, "14:00");
  await simple("pendiente", "QR", 40, CAJERO_B, CAJA_2, D1, "15:00");
  await pool.query("UPDATE pagos.transacciones SET estado = 'Anulado' WHERE id_transaccion = $1", [ops.anulada.id_transaccion]);
  await pool.query("UPDATE pagos.transacciones SET estado_pago = 'RECHAZADA' WHERE id_transaccion = $1", [ops.rechazada.id_transaccion]);
  await pool.query("UPDATE pagos.transacciones SET estado_pago = 'PENDIENTE' WHERE id_transaccion = $1", [ops.pendiente.id_transaccion]);
  // Dia 2: solo QR 33.33
  await simple("q2", "QR", 33.33, CAJERO_A, CAJA_1, D2, "09:30");
});

test.after(async () => {
  const cajeros = [CAJERO_A, CAJERO_B];
  await pool.query("DELETE FROM pagos.transacciones WHERE cajero_id = ANY($1)", [cajeros]);
  await pool.query("DELETE FROM pagos.pagos_mixtos WHERE caja_id = ANY($1)", [[CAJA_1, CAJA_2]]);
  await pool.end();
});

test("TDSI-435: agrupa las ventas del dia por metodo con cantidad, monto y porcentaje", async () => {
  const r = await monitorearMetodos({ fecha: D1 });
  assert.deepEqual(r.filtros, { desde: D1, hasta: D1 });
  assert.equal(r.cantidad_operaciones, 4);
  assert.equal(r.monto_total, 200);
  assert.deepEqual(r.metodos, [
    { metodo: "Efectivo", cantidad: 2, monto: 80, porcentaje: 40 },
    { metodo: "Tarjeta", cantidad: 1, monto: 100, porcentaje: 50 },
    { metodo: "QR", cantidad: 1, monto: 20, porcentaje: 10 },
  ]);
});

test("TDSI-435: siempre trae los 3 metodos (en 0 si no hubo ventas) y respeta decimales", async () => {
  const r = await monitorearMetodos({ fecha: D2 });
  assert.equal(r.monto_total, 33.33);
  assert.deepEqual(r.metodos, [
    { metodo: "Efectivo", cantidad: 0, monto: 0, porcentaje: 0 },
    { metodo: "Tarjeta", cantidad: 0, monto: 0, porcentaje: 0 },
    { metodo: "QR", cantidad: 1, monto: 33.33, porcentaje: 100 },
  ]);

  const vacio = await monitorearMetodos({ fecha: "2021-05-01" });
  assert.equal(vacio.cantidad_operaciones, 0);
  assert.equal(vacio.monto_total, 0);
  assert.ok(vacio.metodos.every((m) => m.cantidad === 0 && m.porcentaje === 0));
});

test("TDSI-435: sin fecha es el dia de hoy y una fecha invalida da 400", async () => {
  const r = await monitorearMetodos();
  assert.deepEqual(r.filtros, { desde: hoyLocal(), hasta: hoyLocal() });
  await assert.rejects(monitorearMetodos({ fecha: "2021-02-30" }), (e) => e.status === 400);
  await assert.rejects(monitorearMetodos({ fecha: "10/05/2021" }), (e) => e.status === 400);
});