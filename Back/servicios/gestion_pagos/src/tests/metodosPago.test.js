// TDSI-34: monitoreo por metodo de pago (usa la BD real; limpia lo que crea).
// Las ventas de prueba se mueven a dias fijos de 2021 para que los totales del dia sean exactos
// aunque haya otras ventas en la BD (las de hoy, las semillas, otros tests corriendo a la vez).
const test = require("node:test");
const assert = require("node:assert/strict");
const { pool } = require("../config/db");
const { registrarPagoSimple } = require("../services/pagoSimpleService");
const { registrarPagoMixto } = require("../services/pagoMixtoService");
const { monitorearMetodos } = require("../services/metodosPagoService");
const { hoyLocal } = require("../utils/fechaLocal");

const SUFIJO = Date.now();
const CAJERO_A = `test.metodos.a.${SUFIJO}@tallersis.bo`;
const CAJERO_B = `test.metodos.b.${SUFIJO}@tallersis.bo`;
const CAJA_1 = `TEST-MET1-${SUFIJO}`;
const CAJA_2 = `TEST-MET2-${SUFIJO}`;
const D1 = "2021-05-10";
const D2 = "2021-05-11";
const D3 = "2021-05-12";
const D4 = "2021-05-13";
const SIN_FILTROS = { caja_id: null, cajero_id: null };

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

  // Dia 3 (TDSI-436): simples Efectivo 80, Tarjeta 100, QR 20 + mixtos Efectivo 25 + QR 15 y Tarjeta 60 + QR 40
  const mixto = async (clave, metodos, cajero, caja, dia, hora) => {
    const total = metodos.reduce((a, m) => a + m.monto, 0);
    ops[clave] = (await registrarPagoMixto({ cajaId: caja, cajero, total, metodos })).pago;
    await moverA(ops[clave].id_transaccion, dia, hora);
  };
  await simple("e3", "Efectivo", 80, CAJERO_A, CAJA_1, D3, "09:00");
  await simple("t3", "Tarjeta", 100, CAJERO_B, CAJA_2, D3, "09:30");
  await simple("q3", "QR", 20, CAJERO_A, CAJA_1, D3, "10:00");
  await mixto("m1", [{ metodo: "Efectivo", monto: 25 }, { metodo: "QR", monto: 15 }], CAJERO_A, CAJA_1, D3, "11:00");
  await mixto("m2", [{ metodo: "Tarjeta", monto: 60 }, { metodo: "QR", monto: 40 }], CAJERO_B, CAJA_2, D3, "12:00");
  // un mixto anulado (cabecera y filas) no suma en ningun metodo
  await mixto("m3", [{ metodo: "Efectivo", monto: 10 }, { metodo: "Tarjeta", monto: 10 }], CAJERO_B, CAJA_2, D3, "13:00");
  await pool.query("UPDATE pagos.transacciones SET estado = 'Anulado' WHERE id_transaccion = $1", [ops.m3.id_transaccion]);
  await pool.query("UPDATE pagos.pagos_mixtos SET estado = 'Anulado' WHERE id_transaccion = $1", [ops.m3.id_transaccion]);

  // Dia 4 (TDSI-437): un mixto antiguo con la caja solo en la cabecera (sus filas sin caja_id)
  await mixto("m4", [{ metodo: "Efectivo", monto: 12 }, { metodo: "Tarjeta", monto: 8 }], CAJERO_A, CAJA_2, D4, "16:00");
  await pool.query("UPDATE pagos.transacciones SET caja_id = NULL WHERE id_transaccion = $1", [ops.m4.id_transaccion]);
});

test.after(async () => {
  const cajeros = [CAJERO_A, CAJERO_B];
  await pool.query("DELETE FROM pagos.transacciones WHERE cajero_id = ANY($1)", [cajeros]);
  await pool.query("DELETE FROM pagos.pagos_mixtos WHERE caja_id = ANY($1)", [[CAJA_1, CAJA_2]]);
  await pool.end();
});

test("TDSI-435: agrupa las ventas del dia por metodo con cantidad, monto y porcentaje", async () => {
  const r = await monitorearMetodos({ fecha: D1 });
  assert.deepEqual(r.filtros, { desde: D1, hasta: D1, ...SIN_FILTROS });
  assert.equal(r.cantidad_operaciones, 4);
  assert.equal(r.monto_total, 200);
  assert.deepEqual(r.metodos.map(({ metodo, cantidad, monto, porcentaje }) => ({ metodo, cantidad, monto, porcentaje })), [
    { metodo: "Efectivo", cantidad: 2, monto: 80, porcentaje: 40 },
    { metodo: "Tarjeta", cantidad: 1, monto: 100, porcentaje: 50 },
    { metodo: "QR", cantidad: 1, monto: 20, porcentaje: 10 },
  ]);
});

test("TDSI-435: siempre trae los 3 metodos (en 0 si no hubo ventas) y respeta decimales", async () => {
  const r = await monitorearMetodos({ fecha: D2 });
  assert.equal(r.monto_total, 33.33);
  assert.deepEqual(r.metodos.map(({ metodo, cantidad, monto, porcentaje }) => ({ metodo, cantidad, monto, porcentaje })), [
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
  assert.deepEqual(r.filtros, { desde: hoyLocal(), hasta: hoyLocal(), ...SIN_FILTROS });
  await assert.rejects(monitorearMetodos({ fecha: "2021-02-30" }), (e) => e.status === 400);
  await assert.rejects(monitorearMetodos({ fecha: "10/05/2021" }), (e) => e.status === 400);
});

const desglose = (simples, mixtos) => ({ simples: { cantidad: simples[0], monto: simples[1] }, mixtos: { cantidad: mixtos[0], monto: mixtos[1] } });

test("TDSI-436: los pagos mixtos suman cada parte en su metodo, desglosado simples / mixtos", async () => {
  const r = await monitorearMetodos({ fecha: D3 });
  assert.equal(r.cantidad_operaciones, 5); // 3 simples + 2 mixtos (cada venta cuenta una vez)
  assert.equal(r.monto_total, 340);
  assert.deepEqual(r.metodos, [
    { metodo: "Efectivo", cantidad: 2, monto: 105, porcentaje: 30.88, ...desglose([1, 80], [1, 25]) },
    { metodo: "Tarjeta", cantidad: 2, monto: 160, porcentaje: 47.06, ...desglose([1, 100], [1, 60]) },
    { metodo: "QR", cantidad: 3, monto: 75, porcentaje: 22.06, ...desglose([1, 20], [2, 55]) },
  ]);
});

test("TDSI-436: resumen de pagos mixtos con sus combinaciones de metodos", async () => {
  const r = await monitorearMetodos({ fecha: D3 });
  assert.deepEqual(r.pagos_mixtos, {
    cantidad: 2,
    monto: 140,
    combinaciones: [
      { metodos: ["Tarjeta", "QR"], cantidad: 1, monto: 100 },
      { metodos: ["Efectivo", "QR"], cantidad: 1, monto: 40 },
    ],
  });

  const soloSimples = await monitorearMetodos({ fecha: D1 });
  assert.deepEqual(soloSimples.pagos_mixtos, { cantidad: 0, monto: 0, combinaciones: [] });
  assert.deepEqual(soloSimples.metodos[0], { metodo: "Efectivo", cantidad: 2, monto: 80, porcentaje: 40, ...desglose([2, 80], [0, 0]) });
});

const resumen = (r) => r.metodos.map((m) => [m.metodo, m.cantidad, m.monto, m.porcentaje]);

test("TDSI-437: rango de fechas (desde/hasta) suma todos los dias", async () => {
  const r = await monitorearMetodos({ desde: D1, hasta: D3 });
  assert.deepEqual(r.filtros, { desde: D1, hasta: D3, ...SIN_FILTROS });
  assert.equal(r.cantidad_operaciones, 10); // 4 + 1 + 5
  assert.equal(r.monto_total, 573.33); // 200 + 33.33 + 340
  assert.deepEqual(resumen(r), [
    ["Efectivo", 4, 185, 32.27],
    ["Tarjeta", 3, 260, 45.35],
    ["QR", 5, 128.33, 22.38],
  ]);
});

test("TDSI-437: filtra por caja (tambien mixtos con la caja solo en la cabecera)", async () => {
  const caja1 = await monitorearMetodos({ desde: D1, hasta: D3, caja_id: CAJA_1 });
  assert.equal(caja1.filtros.caja_id, CAJA_1);
  assert.equal(caja1.cantidad_operaciones, 6);
  assert.equal(caja1.monto_total, 323.33); // 50 + 100 + 33.33 + 80 + 20 + (25 + 15)
  assert.deepEqual(caja1.pagos_mixtos.combinaciones, [{ metodos: ["Efectivo", "QR"], cantidad: 1, monto: 40 }]);

  const antiguo = await monitorearMetodos({ fecha: D4, caja_id: CAJA_2 });
  assert.equal(antiguo.cantidad_operaciones, 1);
  assert.deepEqual(resumen(antiguo), [["Efectivo", 1, 12, 60], ["Tarjeta", 1, 8, 40], ["QR", 0, 0, 0]]);
  const otraCaja = await monitorearMetodos({ fecha: D4, caja_id: CAJA_1 });
  assert.equal(otraCaja.cantidad_operaciones, 0);
});

test("TDSI-437: filtra por cajero y combina con la caja", async () => {
  const b = await monitorearMetodos({ desde: D1, hasta: D3, cajero_id: CAJERO_B });
  assert.equal(b.filtros.cajero_id, CAJERO_B);
  assert.equal(b.cantidad_operaciones, 4); // 30 + 20 (dia 1) + 100 + mixto 100 (dia 3)
  assert.equal(b.monto_total, 250);
  assert.deepEqual(b.pagos_mixtos, { cantidad: 1, monto: 100, combinaciones: [{ metodos: ["Tarjeta", "QR"], cantidad: 1, monto: 100 }] });

  const bEnCaja1 = await monitorearMetodos({ desde: D1, hasta: D3, cajero_id: CAJERO_B, caja_id: CAJA_1 });
  assert.equal(bEnCaja1.cantidad_operaciones, 0);
  assert.equal(bEnCaja1.monto_total, 0);
});

test("TDSI-437: rechaza filtros invalidos con 400", async () => {
  const casos = [
    { desde: D3, hasta: D1 },
    { desde: "2021-01-01", hasta: "2021-12-31" },
    { desde: "2021-13-01" },
    { caja_id: "C".repeat(61) },
    { cajero_id: "x".repeat(61) },
  ];
  for (const filtros of casos) {
    await assert.rejects(monitorearMetodos(filtros), (e) => e.status === 400, JSON.stringify(filtros));
  }
});