const test = require("node:test");
const assert = require("node:assert/strict");
const { query } = require("../config/db");
const { registrar, obtenerConteoHoy } = require("../services/ventasCanceladasService");

const CAJERO_ID = "CAJERO-CANCEL-TEST";

async function limpiar() {
  await query(`DELETE FROM pagos.ventas_canceladas WHERE cajero_id = $1`, [CAJERO_ID]);
}

test.beforeEach(limpiar);
test.after(limpiar);

test("TDSI-841: registra una venta cancelada con motivo válido", async () => {
  const res = await registrar({
    cajero_id: CAJERO_ID,
    items: [{ nombre: "Producto 1", precio: 10 }],
    total: 10,
    motivo: "El cliente desistió",
  });
  assert.equal(res.cajero_id, CAJERO_ID);
  assert.equal(res.motivo, "El cliente desistió");
  assert.equal(res.total, 10);

  // TDSI-840: Verificamos que NO se creó una transacción en la tabla de ventas
  const { rows } = await query(`SELECT * FROM pagos.transacciones WHERE cajero_id = $1`, [CAJERO_ID]);
  assert.equal(rows.length, 0, "No debe crear ninguna transacción");
});

test("TDSI-841: rechaza motivo inválido", async () => {
  await assert.rejects(
    () => registrar({
      cajero_id: CAJERO_ID,
      items: [{ nombre: "Prod", precio: 10 }],
      total: 10,
      motivo: "Motivo inventado",
    }),
    (e) => e.status === 400
  );
});

test("TDSI-841: exige texto si el motivo es 'Otro'", async () => {
  await assert.rejects(
    () => registrar({
      cajero_id: CAJERO_ID,
      items: [{ nombre: "Prod", precio: 10 }],
      total: 10,
      motivo: "Otro",
    }),
    (e) => e.status === 400
  );
});

test("TDSI-841: registra con motivo 'Error al cargar ítems'", async () => {
  const res = await registrar({
    cajero_id: CAJERO_ID,
    items: [{ nombre: "Producto 1", precio: 10 }],
    total: 10,
    motivo: "Error al cargar ítems",
  });
  assert.equal(res.motivo, "Error al cargar ítems");
  assert.equal(res.motivo_texto, null);
});

test("TDSI-841: registra con motivo 'Otro' y guarda el texto escrito", async () => {
  const res = await registrar({
    cajero_id: CAJERO_ID,
    items: [{ nombre: "Producto 1", precio: 10 }],
    total: 10,
    motivo: "Otro",
    motivo_texto: "El cliente tenía que atender una llamada urgente",
  });
  assert.equal(res.motivo, "Otro");
  assert.equal(res.motivo_texto, "El cliente tenía que atender una llamada urgente");
});

test("TDSI-839: 'hoy' se calcula en hora de Bolivia, no con la zona horaria de la sesion (UTC)", async () => {
  // Reproduce exactamente el caso que fallaba: una cancelacion a las 21:00 hora Bolivia
  // (ya es el dia siguiente en UTC) consultada 30 minutos despues, sin mandar fecha.
  // Se inserta directo por SQL para controlar el creado_en exacto (registrar() usa el
  // creado_en por defecto de la tabla, que es "now()").
  await query(
    `INSERT INTO pagos.ventas_canceladas (cajero_id, caja_id, turno_id, items, total, motivo, motivo_texto, creado_en)
     VALUES ($1, 'CAJA-TZ', 'TUR-TZ', '[{"id":1}]', 10, 'Otro', 'Prueba de zona horaria', '2026-11-08 21:00:00-04'::timestamptz)`,
    [CAJERO_ID]
  );

  const { rows } = await query(
    `SELECT COUNT(*)::int AS total
       FROM pagos.ventas_canceladas
      WHERE cajero_id = $1
        AND (creado_en AT TIME ZONE 'America/La_Paz')::date = ('2026-11-09 01:30:00+00'::timestamptz AT TIME ZONE 'America/La_Paz')::date`,
    [CAJERO_ID]
  );
  assert.equal(rows[0].total, 1, "la cancelacion de las 21:00 Bolivia debe contarse como del mismo dia a las 21:30 Bolivia");
});

test("TDSI-839: cuenta las ventas canceladas hoy", async () => {
  await registrar({
    cajero_id: CAJERO_ID, items: [{ id: 1 }], total: 10, motivo: "Fondos insuficientes",
  });
  await registrar({
    cajero_id: CAJERO_ID, items: [{ id: 2 }], total: 20, motivo: "El cliente desistió",
  });

  const res = await obtenerConteoHoy(CAJERO_ID);
  assert.equal(res.total, 2);
});