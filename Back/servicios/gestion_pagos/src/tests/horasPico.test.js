// TDSI-57/191/760/761: ventas agrupadas por hora del dia, en hora de Bolivia (cantidad
// y monto), con filtros por rango de fechas y por caja, sin contar anuladas.
// BD real; limpia lo que crea.
const test = require("node:test");
const assert = require("node:assert/strict");
const { query, pool } = require("../config/db");
const { obtenerVentasPorHora, validarRango } = require("../services/horasPicoService");

const PREFIJO = `HP-${Date.now()}`;
// Rango fijo (Bolivia, -04:00): el test no depende de en que fecha se corra.
const DESDE = "2024-07-10";
const HASTA = "2024-07-11";

async function transaccion(id, monto, fechaIso, { metodo = "Efectivo", cajaId = null, estado = "Registrado" } = {}) {
  await query(
    `INSERT INTO pagos.transacciones (id_transaccion, metodo, monto, tipo_pago, estado, fecha, caja_id)
     VALUES ($1, $2, $3, 'Simple', $4, $5, $6)`,
    [id, metodo, monto, estado, fechaIso, cajaId]
  );
}

test.after(async () => {
  await query(`DELETE FROM pagos.transacciones WHERE id_transaccion LIKE $1`, [`${PREFIJO}%`]);
  await pool.end();
});

test("TDSI-191: agrupa por hora de Bolivia, no por hora UTC", async () => {
  // 23:30 del 10/jul en Bolivia -- en UTC esto ya es 03:30 del 11/jul. Si la consulta
  // usara la hora en UTC, esta venta aparecería en la hora 3, no en la 23.
  await transaccion(`${PREFIJO}-1`, 50, "2024-07-10T23:30:00-04:00");
  // 00:15 del 11/jul en Bolivia -- otra hora, otro dia.
  await transaccion(`${PREFIJO}-2`, 20, "2024-07-11T00:15:00-04:00");

  const r = await obtenerVentasPorHora(DESDE, HASTA);
  assert.deepEqual(r.find((h) => h.hora === 23), { hora: 23, cantidad: 1, monto: 50 });
  assert.deepEqual(r.find((h) => h.hora === 0), { hora: 0, cantidad: 1, monto: 20 });
});

test("TDSI-191: suma cantidad y monto de varias ventas en la misma hora", async () => {
  await transaccion(`${PREFIJO}-3`, 30, "2024-07-10T18:05:00-04:00");
  await transaccion(`${PREFIJO}-4`, 45, "2024-07-10T18:40:00-04:00");

  const r = await obtenerVentasPorHora(DESDE, HASTA);
  const hora18 = r.find((h) => h.hora === 18);
  assert.deepEqual(hora18, { hora: 18, cantidad: 2, monto: 75 });
});

test("TDSI-191: un pago mixto (2 filas, mismo id_transaccion) cuenta como UNA venta", async () => {
  await query(
    `INSERT INTO pagos.transacciones (id_transaccion, metodo, monto, tipo_pago, estado, fecha)
     VALUES ($1, 'Efectivo', 20, 'Mixto', 'Registrado', $2), ($1, 'Tarjeta', 15, 'Mixto', 'Registrado', $2)`,
    [`${PREFIJO}-mixto`, "2024-07-10T12:00:00-04:00"]
  );

  const r = await obtenerVentasPorHora(DESDE, HASTA);
  const hora12 = r.find((h) => h.hora === 12);
  assert.deepEqual(hora12, { hora: 12, cantidad: 1, monto: 35 });
});

test("TDSI-191: no mezcla ventas fuera del rango de fechas pedido", async () => {
  // La hora 18 ya tiene 75 (del test anterior, dentro del rango DESDE-HASTA). Estas dos
  // son del dia antes y del dia despues del rango: si se colaran, la hora 18 sumaria 1073.
  await transaccion(`${PREFIJO}-5`, 999, "2024-07-09T18:00:00-04:00");
  await transaccion(`${PREFIJO}-6`, 999, "2024-07-12T18:00:00-04:00");

  const r = await obtenerVentasPorHora(DESDE, HASTA);
  const totalHora18 = r.find((h) => h.hora === 18)?.monto ?? 0;
  assert.equal(totalHora18, 75, "las ventas fuera del rango no deben sumar");
});

test("TDSI-191: valida el formato y el orden del rango de fechas", () => {
  assert.throws(() => validarRango("10-07-2024", HASTA), (e) => e.status === 400);
  assert.throws(() => validarRango(DESDE, "no-es-fecha"), (e) => e.status === 400);
  assert.throws(() => validarRango("2024-07-15", "2024-07-10"), (e) => e.status === 400);
});

test("TDSI-760: filtra por caja -- sin ella trae todas, con ella solo esa caja", async () => {
  const CAJA_A = `${PREFIJO}-CAJA-A`;
  const CAJA_B = `${PREFIJO}-CAJA-B`;
  await transaccion(`${PREFIJO}-7`, 20, "2024-07-10T20:00:00-04:00", { cajaId: CAJA_A });
  await transaccion(`${PREFIJO}-8`, 30, "2024-07-10T20:10:00-04:00", { cajaId: CAJA_B });

  const sinFiltro = await obtenerVentasPorHora(DESDE, HASTA);
  assert.deepEqual(sinFiltro.find((h) => h.hora === 20), { hora: 20, cantidad: 2, monto: 50 });

  const soloCajaA = await obtenerVentasPorHora(DESDE, HASTA, CAJA_A);
  assert.deepEqual(soloCajaA.find((h) => h.hora === 20), { hora: 20, cantidad: 1, monto: 20 });

  const soloCajaB = await obtenerVentasPorHora(DESDE, HASTA, CAJA_B);
  assert.deepEqual(soloCajaB.find((h) => h.hora === 20), { hora: 20, cantidad: 1, monto: 30 });
});

test("TDSI-760: una caja sin ventas en el rango da la lista vacia (no un error)", async () => {
  const r = await obtenerVentasPorHora(DESDE, HASTA, `${PREFIJO}-CAJA-SIN-VENTAS`);
  assert.deepEqual(r, []);
});

test("TDSI-761: no cuenta las ventas anuladas", async () => {
  await transaccion(`${PREFIJO}-9`, 40, "2024-07-10T21:00:00-04:00", { estado: "Registrado" });
  await transaccion(`${PREFIJO}-10`, 999, "2024-07-10T21:05:00-04:00", { estado: "Anulado" });

  const r = await obtenerVentasPorHora(DESDE, HASTA);
  assert.deepEqual(r.find((h) => h.hora === 21), { hora: 21, cantidad: 1, monto: 40 });
});
