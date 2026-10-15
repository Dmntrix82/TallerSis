// TDSI-27: revision de transacciones por cajero (usa la BD real; limpia lo que crea).
const test = require("node:test");
const assert = require("node:assert/strict");
const { pool } = require("../config/db");
const { registrarPagoSimple } = require("../services/pagoSimpleService");
const { registrarPagoMixto } = require("../services/pagoMixtoService");
const { listarTransaccionesPorCajero, obtenerResumenCajero } = require("../services/revisionService");
const { hoyLocal } = require("../utils/fechaLocal");

const SUFIJO = Date.now();
const CAJERO = `test.revision.${SUFIJO}@tallersis.bo`;
const OTRO_CAJERO = `test.revision.otro.${SUFIJO}@tallersis.bo`;
const CAJA = `TEST-REV-${SUFIJO}`;
const HOY = hoyLocal();
const AYER = new Date(Date.parse(`${HOY}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);

/** Mueve una venta a otro dia (a las 10:00 hora de Bolivia) para probar los filtros por fecha. */
const moverADia = (idTransaccion, dia) =>
  pool.query(
    "UPDATE pagos.transacciones SET fecha = ($2::date + time '10:00')::timestamp AT TIME ZONE 'America/La_Paz' WHERE id_transaccion = $1",
    [idTransaccion, dia]
  );

let ventas = {};

test.before(async () => {
  const simple = (metodo, monto, cajero = CAJERO) => registrarPagoSimple({ metodo, monto, caja_id: CAJA, cajero });
  ventas.efectivo1 = (await simple("Efectivo", 10)).pago;
  ventas.qr1 = (await simple("QR", 20)).pago;
  ventas.tarjeta1 = (await simple("Tarjeta", 30)).pago;
  ventas.mixta = (await registrarPagoMixto({
    cajaId: CAJA, cajero: CAJERO, total: 50,
    metodos: [{ metodo: "Efectivo", monto: 15 }, { metodo: "QR", monto: 35 }],
  })).pago;
  ventas.ayer = (await simple("QR", 99)).pago;
  await moverADia(ventas.ayer.id_transaccion, AYER);
  ventas.otroCajero = (await simple("Efectivo", 7, OTRO_CAJERO)).pago;
});

test.after(async () => {
  await pool.query("DELETE FROM pagos.transacciones WHERE cajero_id = ANY($1)", [[CAJERO, OTRO_CAJERO]]);
  await pool.query("DELETE FROM pagos.pagos_mixtos WHERE caja_id = $1", [CAJA]);
  await pool.end();
});

test("TDSI-427: lista las transacciones de hoy del cajero, de la mas reciente a la mas antigua", async () => {
  const r = await listarTransaccionesPorCajero({ cajero_id: CAJERO });
  assert.equal(r.filtros.desde, HOY);
  assert.equal(r.paginacion.total_registros, 4, "4 ventas hoy (la de ayer y la del otro cajero no)");
  assert.deepEqual(r.transacciones.map((t) => t.total), [50, 30, 20, 10]);
  const t = r.transacciones[1];
  assert.equal(t.caja_id, CAJA);
  assert.equal(t.estado, "APROBADA");
  assert.equal(t.fecha_local, HOY);
  assert.match(t.hora, /^\d{2}:\d{2}:\d{2}$/);
});

test("TDSI-427: el pago mixto es UNA transaccion con el detalle por metodo", async () => {
  const r = await listarTransaccionesPorCajero({ cajero_id: CAJERO });
  const mixta = r.transacciones.find((t) => t.id_transaccion === ventas.mixta.id_transaccion);
  assert.equal(mixta.tipo_pago, "Mixto");
  assert.equal(mixta.total, 50);
  assert.deepEqual(mixta.metodos, ["Efectivo", "QR"]);
  assert.deepEqual(mixta.detalle_metodos, [{ metodo: "Efectivo", monto: 15 }, { metodo: "QR", monto: 35 }]);
});

test("TDSI-427: filtra por metodo (incluye las mixtas que usaron ese metodo)", async () => {
  const r = await listarTransaccionesPorCajero({ cajero_id: CAJERO, metodo: "qr" });
  assert.equal(r.filtros.metodo, "QR");
  assert.deepEqual(r.transacciones.map((t) => t.id_transaccion).sort(), [ventas.qr1.id_transaccion, ventas.mixta.id_transaccion].sort());
});

test("TDSI-427: filtra por fecha y por rango desde/hasta", async () => {
  const soloAyer = await listarTransaccionesPorCajero({ cajero_id: CAJERO, fecha: AYER });
  assert.deepEqual(soloAyer.transacciones.map((t) => t.id_transaccion), [ventas.ayer.id_transaccion]);
  assert.equal(soloAyer.transacciones[0].fecha_local, AYER);

  const rango = await listarTransaccionesPorCajero({ cajero_id: CAJERO, desde: AYER, hasta: HOY });
  assert.equal(rango.paginacion.total_registros, 5);
});

test("TDSI-427: pagina los resultados", async () => {
  const p1 = await listarTransaccionesPorCajero({ cajero_id: CAJERO, por_pagina: 3, pagina: 1 });
  const p2 = await listarTransaccionesPorCajero({ cajero_id: CAJERO, por_pagina: 3, pagina: 2 });
  assert.deepEqual(p1.paginacion, { pagina: 1, por_pagina: 3, total_registros: 4, total_paginas: 2 });
  assert.equal(p1.transacciones.length, 3);
  assert.equal(p2.transacciones.length, 1);
  assert.equal(p2.transacciones[0].total, 10);

  const fuera = await listarTransaccionesPorCajero({ cajero_id: CAJERO, por_pagina: 3, pagina: 9 });
  assert.deepEqual(fuera.transacciones, []);
  assert.equal(fuera.paginacion.total_registros, 4);
});

test("TDSI-427: un cajero sin ventas en el rango devuelve la lista vacia", async () => {
  const r = await listarTransaccionesPorCajero({ cajero_id: "nadie@tallersis.bo" });
  assert.deepEqual(r.transacciones, []);
  assert.equal(r.paginacion.total_paginas, 0);
});

test("TDSI-427: valida cajero, fechas, metodo y paginacion", async () => {
  const casos = [
    {}, { cajero_id: "  " }, { cajero_id: "x".repeat(61) },
    { cajero_id: CAJERO, fecha: "2026-02-31" },
    { cajero_id: CAJERO, desde: HOY, hasta: AYER },
    { cajero_id: CAJERO, desde: "2026-01-01", hasta: "2026-12-31" },
    { cajero_id: CAJERO, metodo: "Cheque" },
    { cajero_id: CAJERO, pagina: 0 }, { cajero_id: CAJERO, por_pagina: 101 }, { cajero_id: CAJERO, pagina: "dos" },
  ];
  for (const c of casos) {
    await assert.rejects(() => listarTransaccionesPorCajero(c), (e) => e.status === 400, JSON.stringify(c));
  }
});


// Ventas de CAJERO hoy: Efectivo 10, QR 20, Tarjeta 30, Mixta (Efectivo 15 + QR 35). Ayer: QR 99.

test("TDSI-428: resumen del cajero: cantidad y total por metodo (la mixta cuenta en sus dos metodos)", async () => {
  const r = await obtenerResumenCajero({ cajero_id: CAJERO });
  assert.equal(r.cajero, CAJERO);
  assert.deepEqual(r.filtros, { desde: HOY, hasta: HOY });
  assert.equal(r.cantidad_transacciones, 4);
  assert.equal(r.cantidad_aprobadas, 4);
  assert.equal(r.total, 110);
  assert.deepEqual(r.por_metodo, [
    { metodo: "Efectivo", cantidad: 2, total: 25 },
    { metodo: "Tarjeta", cantidad: 1, total: 30 },
    { metodo: "QR", cantidad: 2, total: 55 },
  ]);
  const sumaMetodos = r.por_metodo.reduce((acc, m) => acc + m.total, 0);
  assert.equal(sumaMetodos, r.total, "la suma por metodo cuadra con el total");
});

test("TDSI-428: el resumen respeta el rango de fechas", async () => {
  const ayer = await obtenerResumenCajero({ cajero_id: CAJERO, fecha: AYER });
  assert.equal(ayer.cantidad_transacciones, 1);
  assert.equal(ayer.total, 99);
  assert.deepEqual(ayer.por_metodo.find((m) => m.metodo === "QR"), { metodo: "QR", cantidad: 1, total: 99 });
  assert.deepEqual(ayer.por_metodo.find((m) => m.metodo === "Efectivo"), { metodo: "Efectivo", cantidad: 0, total: 0 });

  const dosDias = await obtenerResumenCajero({ cajero_id: CAJERO, desde: AYER, hasta: HOY });
  assert.equal(dosDias.cantidad_transacciones, 5);
  assert.equal(dosDias.total, 209);
});

test("TDSI-428: lo anulado o rechazado no suma al total ni a los metodos", async () => {
  const { pago: anulada } = await registrarPagoSimple({ metodo: "Tarjeta", monto: 40, caja_id: CAJA, cajero: CAJERO });
  const { pago: rechazada } = await registrarPagoSimple({ metodo: "QR", monto: 60, caja_id: CAJA, cajero: CAJERO });
  await pool.query("UPDATE pagos.transacciones SET estado = 'Anulado' WHERE id_transaccion = $1", [anulada.id_transaccion]);
  await pool.query("UPDATE pagos.transacciones SET estado_pago = 'RECHAZADA' WHERE id_transaccion = $1", [rechazada.id_transaccion]);
  try {
    const r = await obtenerResumenCajero({ cajero_id: CAJERO });
    assert.equal(r.cantidad_transacciones, 6);
    assert.equal(r.cantidad_aprobadas, 4);
    assert.equal(r.cantidad_anuladas, 1);
    assert.equal(r.cantidad_rechazadas, 1);
    assert.equal(r.total, 110, "igual que antes");
    assert.equal(r.total_anulado, 40);
    assert.deepEqual(r.por_metodo.find((m) => m.metodo === "Tarjeta"), { metodo: "Tarjeta", cantidad: 1, total: 30 });
  } finally {
    await pool.query("DELETE FROM pagos.transacciones WHERE id_transaccion = ANY($1)", [[anulada.id_transaccion, rechazada.id_transaccion]]);
  }
});

test("TDSI-428: cajero sin ventas -> resumen en 0 con los 3 metodos; valida filtros", async () => {
  const r = await obtenerResumenCajero({ cajero_id: "nadie@tallersis.bo" });
  assert.equal(r.cantidad_transacciones, 0);
  assert.equal(r.total, 0);
  assert.equal(r.ultima_operacion, null);
  assert.deepEqual(r.por_metodo.map((m) => [m.metodo, m.cantidad, m.total]), [["Efectivo", 0, 0], ["Tarjeta", 0, 0], ["QR", 0, 0]]);
  await assert.rejects(() => obtenerResumenCajero({}), (e) => e.status === 400);
  await assert.rejects(() => obtenerResumenCajero({ cajero_id: CAJERO, fecha: "ayer" }), (e) => e.status === 400);
});