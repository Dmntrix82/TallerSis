// TDSI-33: historial de operaciones de cajeros (usa la BD real; limpia lo que crea).
// Las operaciones de prueba se mueven a dias fijos de 2021 para que los conteos sean exactos
// aunque haya otras ventas en la BD (las de hoy, la semilla, otros tests corriendo a la vez).
const test = require("node:test");
const assert = require("node:assert/strict");
const { pool } = require("../config/db");
const { registrarPagoSimple } = require("../services/pagoSimpleService");
const { registrarPagoMixto } = require("../services/pagoMixtoService");
const { consultarHistorial, validarRangoHistorial } = require("../services/historialCajerosService");
const { hoyLocal } = require("../utils/fechaLocal");

const SUFIJO = Date.now();
const CAJERO_A = `test.hist.a.${SUFIJO}@tallersis.bo`;
const CAJERO_B = `test.hist.b.${SUFIJO}@tallersis.bo`;
const CAJA_1 = `TEST-HIST1-${SUFIJO}`;
const CAJA_2 = `TEST-HIST2-${SUFIJO}`;
const D1 = "2021-03-01";
const D2 = "2021-03-02";
const D3 = "2021-03-03";
const RANGO = { desde: D1, hasta: D3 };

/** Mueve una operacion a un dia y hora fijos (hora de Bolivia). */
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
  await simple("a1", "Efectivo", 10, CAJERO_A, CAJA_1, D1, "09:00");
  await simple("a2", "QR", 20, CAJERO_A, CAJA_1, D1, "15:00");
  await simple("a3", "Tarjeta", 30, CAJERO_A, CAJA_2, D2, "11:00");
  ops.a4 = (await registrarPagoMixto({
    cajaId: CAJA_1, cajero: CAJERO_A, total: 20,
    metodos: [{ metodo: "Efectivo", monto: 5 }, { metodo: "QR", monto: 15 }],
  })).pago;
  await moverA(ops.a4.id_transaccion, D3, "10:00");
  await simple("a5", "Efectivo", 50, CAJERO_A, CAJA_1, D3, "12:00");
  await pool.query("UPDATE pagos.transacciones SET estado = 'Anulado' WHERE id_transaccion = $1", [ops.a5.id_transaccion]);
  await simple("b1", "QR", 40, CAJERO_B, CAJA_2, D2, "09:30");
  await simple("b2", "Efectivo", 25, CAJERO_B, CAJA_2, D3, "18:00");
  // una de hoy (sin mover) para probar el rango por defecto
  ops.hoy = (await registrarPagoSimple({ metodo: "Efectivo", monto: 7, caja_id: CAJA_1, cajero: CAJERO_A })).pago;
});

test.after(async () => {
  const cajeros = [CAJERO_A, CAJERO_B];
  await pool.query(
    "DELETE FROM pagos.revisiones_transaccion WHERE id_transaccion IN (SELECT id_transaccion FROM pagos.transacciones WHERE cajero_id = ANY($1))",
    [cajeros]
  );
  await pool.query("DELETE FROM pagos.transacciones WHERE cajero_id = ANY($1)", [cajeros]);
  await pool.query("DELETE FROM pagos.pagos_mixtos WHERE caja_id = ANY($1)", [[CAJA_1, CAJA_2]]);
  await pool.end();
});

const ids = (r) => r.operaciones.map((o) => o.id_transaccion);

test("TDSI-431: lista las operaciones de todos los cajeros del rango, de la mas reciente a la mas antigua", async () => {
  const r = await consultarHistorial(RANGO);
  assert.deepEqual(r.filtros, { desde: D1, hasta: D3, cajero_id: null });
  assert.equal(r.paginacion.total_registros, 7);
  assert.deepEqual(ids(r), [ops.b2, ops.a5, ops.a4, ops.a3, ops.b1, ops.a2, ops.a1].map((o) => o.id_transaccion));

  const mixta = r.operaciones.find((o) => o.id_transaccion === ops.a4.id_transaccion);
  assert.equal(mixta.cajero_id, CAJERO_A);
  assert.equal(mixta.caja_id, CAJA_1);
  assert.equal(mixta.fecha_local, D3);
  assert.equal(mixta.hora, "10:00:00");
  assert.equal(mixta.total, 20);
  assert.deepEqual(mixta.detalle_metodos, [{ metodo: "Efectivo", monto: 5 }, { metodo: "QR", monto: 15 }]);
  assert.equal(mixta.estado, "APROBADA");
  assert.deepEqual(mixta.revision, { estado: "PENDIENTE", nota: null, revisado_por: null, revisado_en: null });

  assert.equal(r.operaciones.find((o) => o.id_transaccion === ops.a5.id_transaccion).estado, "ANULADA");
});

test("TDSI-431: filtra por cajero y por dia", async () => {
  const soloB = await consultarHistorial({ ...RANGO, cajero_id: CAJERO_B });
  assert.deepEqual(ids(soloB), [ops.b2.id_transaccion, ops.b1.id_transaccion]);

  const dia1 = await consultarHistorial({ fecha: D1 });
  assert.deepEqual(ids(dia1), [ops.a2.id_transaccion, ops.a1.id_transaccion]);

  const aEnD2D3 = await consultarHistorial({ desde: D2, hasta: D3, cajero_id: CAJERO_A });
  assert.deepEqual(ids(aEnD2D3), [ops.a5, ops.a4, ops.a3].map((o) => o.id_transaccion));
});

test("TDSI-431: pagina los resultados", async () => {
  const p1 = await consultarHistorial({ ...RANGO, por_pagina: 3 });
  const p3 = await consultarHistorial({ ...RANGO, por_pagina: 3, pagina: 3 });
  assert.deepEqual(p1.paginacion, { pagina: 1, por_pagina: 3, total_registros: 7, total_paginas: 3 });
  assert.equal(p1.operaciones.length, 3);
  assert.deepEqual(ids(p3), [ops.a1.id_transaccion]);

  const fuera = await consultarHistorial({ ...RANGO, por_pagina: 3, pagina: 9 });
  assert.equal(fuera.operaciones.length, 0);
  assert.equal(fuera.paginacion.total_registros, 7);
});

test("TDSI-431: sin fechas son los ultimos 7 dias hasta hoy", async () => {
  const hoy = hoyLocal();
  const r = await consultarHistorial({ cajero_id: CAJERO_A });
  assert.equal(r.filtros.hasta, hoy);
  assert.equal((Date.parse(r.filtros.hasta) - Date.parse(r.filtros.desde)) / 86400000, 6);
  assert.deepEqual(ids(r), [ops.hoy.id_transaccion]);

  assert.deepEqual(validarRangoHistorial({ hasta: D3 }), { desde: "2021-02-25", hasta: D3 });
});

test("TDSI-431: rechaza filtros invalidos con 400", async () => {
  const casos = [
    { fecha: "2021-02-30" },
    { desde: D3, hasta: D1 },
    { desde: "2021-01-01", hasta: "2021-12-31" },
    { ...RANGO, cajero_id: "x".repeat(61) },
    { ...RANGO, pagina: 0 },
    { ...RANGO, por_pagina: 101 },
    { ...RANGO, por_pagina: "abc" },
  ];
  for (const filtros of casos) {
    await assert.rejects(consultarHistorial(filtros), (e) => e.status === 400, JSON.stringify(filtros));
  }
});


const cajeroDia = (cajero_id, cantidad_operaciones, total, cantidad_anuladas = 0, total_anulado = 0) => ({
  cajero_id, cajero: cajero_id, cantidad_operaciones, cantidad_anuladas, total, total_anulado,
});

test("TDSI-432: resumen general, por cajero y por dia de todo el rango", async () => {
  const { resumen } = await consultarHistorial(RANGO);
  assert.equal(resumen.cantidad_operaciones, 7);
  assert.equal(resumen.cantidad_anuladas, 1);
  assert.equal(resumen.total, 145); // solo APROBADAS: 10+20+30+20+40+25
  assert.equal(resumen.total_anulado, 50);

  assert.deepEqual(resumen.por_cajero, [
    {
      ...cajeroDia(CAJERO_A, 5, 80, 1, 50),
      dias_con_operaciones: 3,
      primera_operacion: new Date("2021-03-01T13:00:00Z"), // 09:00 en Bolivia
      ultima_operacion: new Date("2021-03-03T16:00:00Z"),
    },
    {
      ...cajeroDia(CAJERO_B, 2, 65),
      dias_con_operaciones: 2,
      primera_operacion: new Date("2021-03-02T13:30:00Z"),
      ultima_operacion: new Date("2021-03-03T22:00:00Z"),
    },
  ]);

  assert.deepEqual(resumen.por_dia, [
    { fecha: D3, cantidad_operaciones: 3, cantidad_anuladas: 1, total: 45, total_anulado: 50,
      cajeros: [cajeroDia(CAJERO_A, 2, 20, 1, 50), cajeroDia(CAJERO_B, 1, 25)] },
    { fecha: D2, cantidad_operaciones: 2, cantidad_anuladas: 0, total: 70, total_anulado: 0,
      cajeros: [cajeroDia(CAJERO_A, 1, 30), cajeroDia(CAJERO_B, 1, 40)] },
    { fecha: D1, cantidad_operaciones: 2, cantidad_anuladas: 0, total: 30, total_anulado: 0,
      cajeros: [cajeroDia(CAJERO_A, 2, 30)] },
  ]);
});

test("TDSI-432: el resumen es de todo lo filtrado, no solo de la pagina", async () => {
  const completo = await consultarHistorial(RANGO);
  const pagina3 = await consultarHistorial({ ...RANGO, por_pagina: 3, pagina: 3 });
  assert.equal(pagina3.operaciones.length, 1);
  assert.deepEqual(pagina3.resumen, completo.resumen);
});

test("TDSI-432: el resumen respeta el filtro de cajero y de fechas", async () => {
  const soloB = await consultarHistorial({ ...RANGO, cajero_id: CAJERO_B });
  assert.equal(soloB.resumen.cantidad_operaciones, 2);
  assert.equal(soloB.resumen.total, 65);
  assert.deepEqual(soloB.resumen.por_cajero.map((c) => c.cajero_id), [CAJERO_B]);
  assert.deepEqual(soloB.resumen.por_dia.map((d) => [d.fecha, d.total]), [[D3, 25], [D2, 40]]);

  const vacio = await consultarHistorial({ desde: "2021-01-01", hasta: "2021-01-02" });
  assert.deepEqual(vacio.resumen, {
    cantidad_operaciones: 0, cantidad_anuladas: 0, total: 0, total_anulado: 0, por_cajero: [], por_dia: [],
  });
});