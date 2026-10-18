// TDSI-145: tests del monitoreo por metodo de pago sobre la semilla sql/seed_metodos.sql.
// Cargan la semilla al empezar y la QUITAN al terminar (si la estaban usando para una
// demo en la BD compartida, vuelvan a correr seed_metodos.sql despues de los tests).
// Se filtra siempre por las cajas o cajeros de la semilla, asi los resultados son exactos
// aunque la BD tenga ventas reales en esos mismos dias.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pool } = require("../config/db");
const { monitorearMetodos } = require("../services/metodosPagoService");
const { obtenerPorTransaccion } = require("../services/pagoMixtoService");
const { hoyLocal } = require("../utils/fechaLocal");

const SEMILLA = fs.readFileSync(path.join(__dirname, "../../sql/seed_metodos.sql"), "utf8");
const KAREN = "karen.demo@tallersis.bo";
const LUIS = "luis.demo@tallersis.bo";
const CAJA_1 = "DEMO-MET-CAJA-1";
const CAJA_2 = "DEMO-MET-CAJA-2";
const HOY = hoyLocal();
const diasAtras = (n) => new Date(Date.parse(`${HOY}T12:00:00Z`) - n * 86400000).toISOString().slice(0, 10);
const RANGO = { desde: diasAtras(3), hasta: diasAtras(1) };

const quitarSemilla = async () => {
  await pool.query("DELETE FROM pagos.transacciones WHERE id_transaccion LIKE 'DEMO-MET-%'");
  await pool.query("DELETE FROM pagos.pagos_mixtos WHERE id_transaccion LIKE 'DEMO-MET-%'");
};

test.before(() => pool.query(SEMILLA));
test.after(async () => {
  await quitarSemilla();
  await pool.end();
});

const desglose = (m) => [m.metodo, m.cantidad, m.monto, m.porcentaje, m.simples.cantidad, m.simples.monto, m.mixtos.cantidad, m.mixtos.monto];

test("TDSI-145: la semilla se puede correr varias veces sin duplicar", async () => {
  await pool.query(SEMILLA);
  const { rows } = await pool.query(
    `SELECT (SELECT count(DISTINCT id_transaccion)::int FROM pagos.transacciones WHERE id_transaccion LIKE 'DEMO-MET-%') AS ventas,
            (SELECT count(*)::int FROM pagos.transacciones WHERE id_transaccion LIKE 'DEMO-MET-%') AS filas,
            (SELECT count(*)::int FROM pagos.pagos_mixtos WHERE id_transaccion LIKE 'DEMO-MET-%') AS mixtos,
            (SELECT count(*)::int FROM pagos.detalles_pago d JOIN pagos.pagos_mixtos pm ON pm.id = d.pago_id
              WHERE pm.id_transaccion LIKE 'DEMO-MET-%') AS detalles`
  );
  assert.deepEqual(rows[0], { ventas: 11, filas: 16, mixtos: 5, detalles: 10 });
});

test("TDSI-145: metodos de la caja 1 (karen) con el desglose simples / mixtos", async () => {
  const r = await monitorearMetodos({ ...RANGO, caja_id: CAJA_1 });
  assert.equal(r.cantidad_operaciones, 4); // la rechazada (007) y el mixto anulado (009) no cuentan
  assert.equal(r.monto_total, 499.9);
  assert.deepEqual(r.metodos.map(desglose), [
    ["Efectivo", 3, 200, 40.01, 1, 120, 2, 80],
    ["Tarjeta", 2, 249.9, 49.99, 1, 99.9, 1, 150],
    ["QR", 1, 50, 10, 0, 0, 1, 50],
  ]);
  assert.deepEqual(r.pagos_mixtos, {
    cantidad: 2,
    monto: 280,
    combinaciones: [
      { metodos: ["Efectivo", "Tarjeta"], cantidad: 1, monto: 180 },
      { metodos: ["Efectivo", "QR"], cantidad: 1, monto: 100 },
    ],
  });
});

test("TDSI-145: metodos de la caja 2 (luis), incluido el mixto con la caja solo en la cabecera", async () => {
  const r = await monitorearMetodos({ ...RANGO, caja_id: CAJA_2 });
  assert.equal(r.cantidad_operaciones, 5);
  assert.equal(r.monto_total, 515);
  assert.deepEqual(r.metodos.map(desglose), [
    ["Efectivo", 3, 119.5, 23.2, 1, 64.5, 2, 55],
    ["Tarjeta", 1, 240, 46.6, 1, 240, 0, 0],
    ["QR", 3, 155.5, 30.19, 1, 85, 2, 70.5],
  ]);
  assert.deepEqual(r.pagos_mixtos.combinaciones, [{ metodos: ["Efectivo", "QR"], cantidad: 2, monto: 125.5 }]);
});

test("TDSI-145: por cajero coincide con su caja, y un solo dia", async () => {
  const karen = await monitorearMetodos({ ...RANGO, cajero_id: KAREN });
  const luis = await monitorearMetodos({ ...RANGO, cajero_id: LUIS });
  assert.equal(karen.monto_total, 499.9);
  assert.equal(luis.monto_total, 515);
  assert.equal(Math.round((karen.monto_total + luis.monto_total) * 100) / 100, 1014.9);

  const ayerCaja2 = await monitorearMetodos({ fecha: diasAtras(1), caja_id: CAJA_2 });
  assert.equal(ayerCaja2.cantidad_operaciones, 2); // 008 y el mixto 010
  assert.equal(ayerCaja2.monto_total, 130);
});

test("TDSI-145: el detalle del pago mixto de la semilla se puede consultar", async () => {
  const r = await obtenerPorTransaccion("DEMO-MET-005");
  assert.equal(r.total, 180);
  assert.deepEqual(r.detalle.map((d) => [d.orden, d.metodo, d.monto, d.porcentaje]), [[1, "Tarjeta", 150, 83.33], [2, "Efectivo", 30, 16.67]]);
});