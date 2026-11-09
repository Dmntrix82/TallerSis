// TDSI-56/737: GET /api/tablero/comparativo-mensual?mes=&anio=. BD real; limpia lo que crea.
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { query, pool } = require("../config/db");
const { errorHandler } = require("../middlewares/errorHandler");

const PREFIJO = `CMPR-${Date.now()}`;
let servidor, base;

async function transaccion(id, monto, fechaIso) {
  await query(
    `INSERT INTO pagos.transacciones (id_transaccion, metodo, monto, tipo_pago, estado, fecha)
     VALUES ($1, 'Efectivo', $2, 'Simple', 'Registrado', $3)`,
    [id, monto, fechaIso]
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

test("TDSI-737: GET /comparativo-mensual?mes=&anio= trae el total, por caja y por metodo con variacion", async () => {
  await transaccion(`${PREFIJO}-1`, 100, "2019-05-10T10:00:00-04:00"); // mayo 2019 (mes elegido)
  await transaccion(`${PREFIJO}-2`, 40, "2019-04-10T10:00:00-04:00"); // abril 2019 (mes anterior)

  const r = await fetch(`${base}/comparativo-mensual?mes=5&anio=2019`);
  assert.equal(r.status, 200);
  const cuerpo = await r.json();
  assert.equal(cuerpo.ok, true);
  assert.equal(cuerpo.data.mes, 5);
  assert.equal(cuerpo.data.anio, 2019);
  assert.equal(cuerpo.data.mesAnterior, 4);
  assert.equal(cuerpo.data.anioAnterior, 2019);
  // (100-40)/40*100 = 150
  assert.deepEqual(cuerpo.data.total, { actual: 100, anterior: 40, variacion: 150 });
  assert.ok(Array.isArray(cuerpo.data.porCaja));
  assert.ok(Array.isArray(cuerpo.data.porMetodo));
});

test("TDSI-737: sin mes/anio, usa el mes y año de hoy (en hora de Bolivia)", async () => {
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/La_Paz" });
  const [anioHoy, mesHoy] = hoy.split("-").map(Number);

  const r = await fetch(`${base}/comparativo-mensual`);
  assert.equal(r.status, 200);
  const cuerpo = await r.json();
  assert.equal(cuerpo.data.mes, mesHoy);
  assert.equal(cuerpo.data.anio, anioHoy);
});

test("TDSI-737: valida mes y año", async () => {
  const mesInvalido = await fetch(`${base}/comparativo-mensual?mes=13&anio=2021`);
  assert.equal(mesInvalido.status, 400);

  const anioInvalido = await fetch(`${base}/comparativo-mensual?mes=5&anio=1800`);
  assert.equal(anioInvalido.status, 400);
});
