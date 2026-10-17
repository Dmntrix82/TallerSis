// TDSI-143: tests del historial de cajeros sobre la semilla sql/seed_historial.sql.
// Cargan la semilla al empezar y la QUITAN al terminar (si la estaban usando para una
// demo en la BD compartida, vuelvan a correr seed_historial.sql despues de los tests).
// Se filtra siempre por los cajeros o cajas de la semilla, asi los resultados son exactos
// aunque la BD tenga ventas reales en esos mismos dias.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pool } = require("../config/db");
const { consultarHistorial } = require("../services/historialCajerosService");
const { hoyLocal } = require("../utils/fechaLocal");

const SEMILLA = fs.readFileSync(path.join(__dirname, "../../sql/seed_historial.sql"), "utf8");
const HUGO = "hugo.demo@tallersis.bo";
const INES = "ines.demo@tallersis.bo";
const JORGE = "jorge.demo@tallersis.bo";
const CAJA_1 = "DEMO-HIST-CAJA-1";
const CAJA_2 = "DEMO-HIST-CAJA-2";
const HOY = hoyLocal();
const diasAtras = (n) => new Date(Date.parse(`${HOY}T12:00:00Z`) - n * 86400000).toISOString().slice(0, 10);

const quitarSemilla = async () => {
  await pool.query("DELETE FROM pagos.revisiones_transaccion WHERE id_transaccion LIKE 'DEMO-HIST-%'");
  await pool.query("DELETE FROM pagos.transacciones WHERE id_transaccion LIKE 'DEMO-HIST-%'");
  await pool.query("DELETE FROM pagos.pagos_mixtos WHERE id_transaccion LIKE 'DEMO-HIST-%'");
};

test.before(() => pool.query(SEMILLA));
test.after(async () => {
  await quitarSemilla();
  await pool.end();
});

const ids = (r) => r.operaciones.map((o) => o.id_transaccion);
const resumenCajero = (r) => {
  const c = r.resumen.por_cajero[0];
  return [c.cantidad_operaciones, c.cantidad_anuladas, c.total, c.total_anulado, c.dias_con_operaciones];
};

test("TDSI-143: la semilla se puede correr varias veces sin duplicar", async () => {
  await pool.query(SEMILLA);
  const { rows } = await pool.query(
    `SELECT (SELECT count(DISTINCT id_transaccion)::int FROM pagos.transacciones WHERE id_transaccion LIKE 'DEMO-HIST-%') AS operaciones,
            (SELECT count(*)::int FROM pagos.transacciones WHERE id_transaccion LIKE 'DEMO-HIST-%') AS filas,
            (SELECT count(*)::int FROM pagos.revisiones_transaccion WHERE id_transaccion LIKE 'DEMO-HIST-%') AS revisiones`
  );
  assert.deepEqual(rows[0], { operaciones: 14, filas: 15, revisiones: 5 });
});

test("TDSI-143: historial por defecto (ultimos 7 dias) de cada cajero de la semilla", async () => {
  const hugo = await consultarHistorial({ cajero_id: HUGO });
  assert.deepEqual(hugo.filtros, { desde: diasAtras(6), hasta: HOY, cajero_id: HUGO, caja_id: null, metodo: null, estado_revision: null });
  assert.deepEqual(ids(hugo), ["DEMO-HIST-012", "DEMO-HIST-008", "DEMO-HIST-006", "DEMO-HIST-003", "DEMO-HIST-001"]);
  assert.deepEqual(resumenCajero(hugo), [5, 1, 262, 27, 5]);

  const ines = await consultarHistorial({ cajero_id: INES });
  assert.deepEqual(resumenCajero(ines), [5, 0, 150.5, 0, 5]);
  const mixta = ines.operaciones.find((o) => o.id_transaccion === "DEMO-HIST-005");
  assert.deepEqual(mixta.detalle_metodos, [{ metodo: "Efectivo", monto: 20 }, { metodo: "Tarjeta", monto: 60 }]);
  assert.equal(mixta.fecha_local, diasAtras(4));
  assert.equal(mixta.hora, "12:30:00");
  assert.equal(ines.operaciones.find((o) => o.id_transaccion === "DEMO-HIST-009").estado, "RECHAZADA");

  const jorge = await consultarHistorial({ cajero_id: JORGE });
  assert.deepEqual(resumenCajero(jorge), [4, 0, 393.4, 0, 4]);
});

test("TDSI-143: resumen por dia y por cajero de cada caja", async () => {
  const caja1 = await consultarHistorial({ caja_id: CAJA_1 });
  assert.equal(caja1.resumen.cantidad_operaciones, 6);
  assert.equal(caja1.resumen.total, 327);
  assert.deepEqual(caja1.resumen.por_cajero.map((c) => [c.cajero_id, c.total]), [[HUGO, 262], [JORGE, 65]]);

  const caja2 = await consultarHistorial({ caja_id: CAJA_2 });
  assert.equal(caja2.resumen.total, 478.9);
  assert.deepEqual(caja2.resumen.por_dia.map((d) => [d.fecha, d.cantidad_operaciones, d.total]), [
    [diasAtras(1), 2, 115.4],
    [diasAtras(2), 1, 23],
    [diasAtras(3), 2, 210],
    [diasAtras(4), 1, 80],
    [diasAtras(5), 1, 18.5],
    [diasAtras(6), 1, 32],
  ]);
  const dia1 = caja2.resumen.por_dia[0];
  assert.deepEqual(dia1.cajeros.map((c) => [c.cajero_id, c.total]), [[INES, 15.5], [JORGE, 99.9]]);
});

test("TDSI-143: filtros por metodo y estado de revision sobre la semilla", async () => {
  const efectivoCaja2 = await consultarHistorial({ caja_id: CAJA_2, metodo: "Efectivo" });
  assert.deepEqual(ids(efectivoCaja2), ["DEMO-HIST-011", "DEMO-HIST-005", "DEMO-HIST-004"]);
  assert.equal(efectivoCaja2.resumen.total, 121.5); // la mixta suma completa (80)

  const observadas = [];
  for (const caja_id of [CAJA_1, CAJA_2]) {
    const r = await consultarHistorial({ caja_id, estado_revision: "OBSERVADA" });
    observadas.push(...r.operaciones.map((o) => [o.id_transaccion, o.revision.nota]));
  }
  assert.deepEqual(observadas.sort(), [
    ["DEMO-HIST-003", "Voucher de tarjeta ilegible"],
    ["DEMO-HIST-010", "Pago QR sin comprobante"],
  ]);

  const pendientesHugo = await consultarHistorial({ cajero_id: HUGO, estado_revision: "PENDIENTE" });
  assert.deepEqual(ids(pendientesHugo), ["DEMO-HIST-008", "DEMO-HIST-006"]);
});

test("TDSI-143: un solo dia y paginacion", async () => {
  const ayer = await consultarHistorial({ fecha: diasAtras(1), caja_id: CAJA_2, por_pagina: 1 });
  assert.deepEqual(ayer.paginacion, { pagina: 1, por_pagina: 1, total_registros: 2, total_paginas: 2 });
  assert.deepEqual(ids(ayer), ["DEMO-HIST-014"]);
  assert.equal(ayer.resumen.total, 115.4);
});