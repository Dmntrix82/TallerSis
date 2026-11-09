// TDSI-57/763: GET /api/tablero/horas-pico?desde=&hasta=&caja=. BD real; limpia lo que crea.
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { query, pool } = require("../config/db");
const { errorHandler } = require("../middlewares/errorHandler");

const PREFIJO = `HPR-${Date.now()}`;
const DESDE = "2024-08-05";
const HASTA = "2024-08-06";
let servidor, base;

async function transaccion(id, monto, fechaIso, { cajaId = null } = {}) {
  await query(
    `INSERT INTO pagos.transacciones (id_transaccion, metodo, monto, tipo_pago, estado, fecha, caja_id)
     VALUES ($1, 'Efectivo', $2, 'Simple', 'Registrado', $3, $4)`,
    [id, monto, fechaIso, cajaId]
  );
}

test.before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/tablero", require("../routes/tableroRoutes"));
  app.use(errorHandler);
  await new Promise((ok) => { servidor = app.listen(0, ok); });
  base = `http://localhost:${servidor.address().port}/api/tablero`;
});

test.after(async () => {
  servidor.close();
  await query(`DELETE FROM pagos.transacciones WHERE id_transaccion LIKE $1`, [`${PREFIJO}%`]);
  await pool.end();
});

test("TDSI-763: GET /horas-pico?desde=&hasta= trae el detalle por hora y las 3 horas pico", async () => {
  await transaccion(`${PREFIJO}-1`, 20, "2024-08-05T18:00:00-04:00");
  await transaccion(`${PREFIJO}-2`, 30, "2024-08-05T18:10:00-04:00");
  await transaccion(`${PREFIJO}-3`, 999, "2024-08-05T10:00:00-04:00", { cajaId: `${PREFIJO}-OTRA-CAJA` });

  const r = await fetch(`${base}/horas-pico?desde=${DESDE}&hasta=${HASTA}`);
  assert.equal(r.status, 200);
  const cuerpo = await r.json();
  assert.equal(cuerpo.ok, true);
  assert.deepEqual(cuerpo.data.horas.find((h) => h.hora === 18), { hora: 18, cantidad: 2, monto: 50 });
  assert.ok(cuerpo.data.top3.length >= 1);
  assert.equal(cuerpo.data.top3[0].hora, 18); // 2 ventas, mas que cualquier otra hora del rango
});

test("TDSI-763: filtra por caja (?caja=)", async () => {
  const CAJA = `${PREFIJO}-CAJA-FILTRO`;
  await transaccion(`${PREFIJO}-4`, 15, "2024-08-05T14:00:00-04:00", { cajaId: CAJA });
  await transaccion(`${PREFIJO}-5`, 25, "2024-08-05T14:05:00-04:00"); // otra caja (null)

  const r = await fetch(`${base}/horas-pico?desde=${DESDE}&hasta=${HASTA}&caja=${CAJA}`);
  const cuerpo = await r.json();
  assert.deepEqual(cuerpo.data.horas.find((h) => h.hora === 14), { hora: 14, cantidad: 1, monto: 15 });
});

test("TDSI-763: exige desde/hasta con formato valido", async () => {
  const sinFechas = await fetch(`${base}/horas-pico`);
  assert.equal(sinFechas.status, 400);

  const fechaInvalida = await fetch(`${base}/horas-pico?desde=10-08-2024&hasta=${HASTA}`);
  assert.equal(fechaInvalida.status, 400);
});
