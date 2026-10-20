// TDSI-430: tests de la revision de transacciones sobre la semilla sql/seed_revision.sql.
// Cargan la semilla al empezar y la QUITAN al terminar (si la estaban usando para una
// demo en la BD compartida, vuelvan a correr seed_revision.sql despues de los tests).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pool } = require("../config/db");
const { listarTransaccionesPorCajero, obtenerResumenCajero, marcarRevision } = require("../services/revisionService");
const { hoyLocal } = require("../utils/fechaLocal");

const SEMILLA = fs.readFileSync(path.join(__dirname, "../../sql/seed_revision.sql"), "utf8");
const DIEGO = "diego.demo@tallersis.bo";
const ELENA = "elena.demo@tallersis.bo";
const HOY = hoyLocal();
const diasAtras = (n) => new Date(Date.parse(`${HOY}T12:00:00Z`) - n * 86400000).toISOString().slice(0, 10);

const quitarSemilla = async () => {
  await pool.query("DELETE FROM pagos.revisiones_transaccion WHERE id_transaccion LIKE 'DEMO-REV-%'");
  await pool.query("DELETE FROM pagos.transacciones WHERE id_transaccion LIKE 'DEMO-REV-%'");
  await pool.query("DELETE FROM pagos.pagos_mixtos WHERE id_transaccion LIKE 'DEMO-REV-%'");
};

test.before(() => pool.query(SEMILLA));
test.after(async () => {
  await quitarSemilla();
  await pool.end();
});

test("TDSI-430: la semilla se puede correr varias veces sin duplicar", async () => {
  await pool.query(SEMILLA);
  const { rows } = await pool.query(
    `SELECT (SELECT count(DISTINCT id_transaccion)::int FROM pagos.transacciones WHERE id_transaccion LIKE 'DEMO-REV-%') AS ventas,
            (SELECT count(*)::int FROM pagos.transacciones WHERE id_transaccion LIKE 'DEMO-REV-%') AS filas,
            (SELECT count(*)::int FROM pagos.revisiones_transaccion WHERE id_transaccion LIKE 'DEMO-REV-%') AS revisiones`
  );
  assert.deepEqual(rows[0], { ventas: 11, filas: 12, revisiones: 3 });
});

test("TDSI-430/427: lista las 6 ventas de hoy de Diego, la mixta como una sola", async () => {
  const r = await listarTransaccionesPorCajero({ cajero_id: DIEGO });
  assert.equal(r.paginacion.total_registros, 6);
  assert.deepEqual(r.transacciones.map((t) => t.id_transaccion),
    ["DEMO-REV-006", "DEMO-REV-005", "DEMO-REV-004", "DEMO-REV-003", "DEMO-REV-002", "DEMO-REV-001"]);
  const mixta = r.transacciones.find((t) => t.id_transaccion === "DEMO-REV-004");
  assert.deepEqual(mixta.detalle_metodos, [{ metodo: "Efectivo", monto: 30 }, { metodo: "QR", monto: 70 }]);
  assert.equal(mixta.total, 100);
  assert.deepEqual(r.transacciones.map((t) => t.estado),
    ["RECHAZADA", "ANULADA", "APROBADA", "APROBADA", "APROBADA", "APROBADA"]);
});

test("TDSI-430/427: filtros por metodo, rango y paginacion sobre la semilla", async () => {
  const qr = await listarTransaccionesPorCajero({ cajero_id: DIEGO, metodo: "QR" });
  assert.deepEqual(qr.transacciones.map((t) => t.id_transaccion), ["DEMO-REV-006", "DEMO-REV-004", "DEMO-REV-002"]);

  const ayer = await listarTransaccionesPorCajero({ cajero_id: DIEGO, fecha: diasAtras(1) });
  assert.deepEqual(ayer.transacciones.map((t) => [t.id_transaccion, t.hora]), [["DEMO-REV-008", "16:45:00"], ["DEMO-REV-007", "10:30:00"]]);

  const tresDias = await listarTransaccionesPorCajero({ cajero_id: DIEGO, desde: diasAtras(2), hasta: HOY, por_pagina: 4, pagina: 3 });
  assert.deepEqual(tresDias.paginacion, { pagina: 3, por_pagina: 4, total_registros: 9, total_paginas: 3 });
  assert.deepEqual(tresDias.transacciones.map((t) => t.id_transaccion), ["DEMO-REV-009"]);
});

test("TDSI-430/428: resumen de hoy de Diego: cantidad y total por metodo", async () => {
  const r = await obtenerResumenCajero({ cajero_id: DIEGO });
  assert.equal(r.cantidad_transacciones, 6);
  assert.equal(r.cantidad_aprobadas, 4);
  assert.equal(r.cantidad_anuladas, 1);
  assert.equal(r.cantidad_rechazadas, 1);
  assert.equal(r.total, 285);          // 25 + 40 + 120 + 100
  assert.equal(r.total_anulado, 55);
  assert.deepEqual(r.por_metodo, [
    { metodo: "Efectivo", cantidad: 2, total: 55 },  // 25 + 30 (mixta)
    { metodo: "Tarjeta", cantidad: 1, total: 120 },
    { metodo: "QR", cantidad: 2, total: 110 },       // 40 + 70 (mixta); la rechazada de 15 no suma
  ]);
  assert.deepEqual(r.revision, { revisadas: 1, observadas: 1, sin_revisar: 4 });
});

test("TDSI-430/428: cada cajero tiene su propio resumen", async () => {
  const elena = await obtenerResumenCajero({ cajero_id: ELENA });
  assert.equal(elena.cantidad_transacciones, 2);
  assert.equal(elena.total, 82);
  const tresDias = await obtenerResumenCajero({ cajero_id: DIEGO, desde: diasAtras(2), hasta: HOY });
  assert.equal(tresDias.total, 687.5);  // 285 + 80 + 22.5 + 300
  assert.deepEqual(tresDias.revision, { revisadas: 2, observadas: 1, sin_revisar: 6 });
});

test("TDSI-430/429: las revisiones de la semilla y marcar una nueva", async () => {
  const observadas = await listarTransaccionesPorCajero({ cajero_id: DIEGO, estado_revision: "OBSERVADA" });
  assert.equal(observadas.transacciones.length, 1);
  assert.deepEqual(
    { ...observadas.transacciones[0].revision, revisado_en: undefined },
    { estado: "OBSERVADA", nota: "Voucher de tarjeta sin firma", revisado_por: "supervisor.demo", revisado_en: undefined }
  );

  await marcarRevision({ id_transaccion: "DEMO-REV-002", estado: "REVISADA", revisado_por: "supervisor.test" });
  await marcarRevision({ id_transaccion: "DEMO-REV-003", estado: "REVISADA", nota: "Firma conseguida", revisado_por: "supervisor.test" });

  const r = await obtenerResumenCajero({ cajero_id: DIEGO });
  assert.deepEqual(r.revision, { revisadas: 3, observadas: 0, sin_revisar: 3 });
  const pendientes = await listarTransaccionesPorCajero({ cajero_id: DIEGO, estado_revision: "PENDIENTE" });
  assert.deepEqual(pendientes.transacciones.map((t) => t.id_transaccion), ["DEMO-REV-006", "DEMO-REV-005", "DEMO-REV-004"]);
});