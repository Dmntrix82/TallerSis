// TDSI-52/698: resolver una diferencia publica el aviso "diferencia_caja" a Contabilidad,
// con Pub/Sub simulado. BD real; limpia lo que crea.
process.env.CONTABILIDAD_PUBSUB_TOPIC = "projects/proyecto-prueba/topics/topico-a";

const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { query } = require("../config/db");
const { errorHandler } = require("../middlewares/errorHandler");
const { resolverDiferencia } = require("../services/diferenciasService");
const publisher = require("../clients/pubsubPublisher");

const CAJA = "CAJA-TEST-698";
const DIA = "2021-09-05";
const en = (hora) => `${DIA} ${hora}-04`;
let servidor, base;
let contadorTurnos = 0;

async function limpiar() {
  await query(`DELETE FROM caja.diferencias_resolucion WHERE turno_id IN (SELECT id FROM caja.turnos WHERE caja_id = $1)`, [CAJA]);
  await query(`DELETE FROM caja.turnos WHERE caja_id = $1`, [CAJA]);
  await query(`DELETE FROM caja.cajas WHERE codigo = $1`, [CAJA]);
}

async function turnoCerrado() {
  contadorTurnos += 1;
  const { rows } = await query(
    `INSERT INTO caja.turnos (codigo, caja_id, cajero_id, cajero_nombre, efectivo_inicial, estado, abierto_en, cerrado_en)
     VALUES ($1, $2, 'CAJ-698', 'Beto Mamani', 100, 'CERRADO', $3, $4) RETURNING id`,
    [`TUR-TEST-698-${contadorTurnos}`, CAJA, en("08:00"), en("12:00")]
  );
  return Number(rows[0].id);
}

async function diferenciaPendiente(turnoId, { tipo = "FALTANTE", monto = 20 } = {}) {
  const { rows } = await query(
    `INSERT INTO caja.diferencias_resolucion (turno_id, monto, tipo) VALUES ($1, $2, $3) RETURNING id`,
    [turnoId, monto, tipo]
  );
  return Number(rows[0].id);
}

test.before(async () => {
  await limpiar();
  await query(`INSERT INTO caja.cajas (codigo, nombre, estado) VALUES ($1, 'Caja Test 698', 'ACTIVA')`, [CAJA]);
  publisher.usarClienteDePrueba({ topic: () => ({ publishMessage: async () => "pub-698-1" }) });

  const app = express();
  app.use(express.json());
  app.use("/api/caja", require("../routes/diferenciasRoutes"));
  app.use(errorHandler);
  await new Promise((ok) => { servidor = app.listen(0, ok); });
  base = `http://localhost:${servidor.address().port}/api/caja`;
});

test.after(async () => {
  servidor.close();
  publisher.usarClienteDePrueba(null);
  await limpiar();
});

test("TDSI-698: resuelve la diferencia y publica el aviso a Contabilidad", async () => {
  const turnoId = await turnoCerrado();
  const id = await diferenciaPendiente(turnoId, { tipo: "FALTANTE", monto: 20 });

  const r = await resolverDiferencia(id, { justificacion: "Faltó contar un billete", resuelta_por: "admin@tallersis.bo" });

  assert.equal(r.diferencia.estado, "RESUELTA");
  assert.equal(r.diferencia.justificacion, "Faltó contar un billete");
  assert.equal(r.diferencia.resuelta_por, "admin@tallersis.bo");
  assert.ok(r.diferencia.resuelta_en);
  assert.deepEqual(r.contabilidad, { publicado: true, messageId: "pub-698-1", estado: "Enviado" });

  const { rows } = await query(`SELECT estado, justificacion FROM caja.diferencias_resolucion WHERE id = $1`, [id]);
  assert.equal(rows[0].estado, "RESUELTA");
  assert.equal(rows[0].justificacion, "Faltó contar un billete");

  // TDSI-699: el intento de aviso quedo registrado en la tabla de envios.
  const { rows: envio } = await query(`SELECT estado, pubsub_message_id, intentos FROM caja.diferencias_envios_contabilidad WHERE diferencia_id = $1`, [id]);
  assert.deepEqual(envio[0], { estado: "Enviado", pubsub_message_id: "pub-698-1", intentos: 1 });
});

test("TDSI-698: exige justificacion", async () => {
  const turnoId = await turnoCerrado();
  const id = await diferenciaPendiente(turnoId);
  await assert.rejects(() => resolverDiferencia(id, { justificacion: "   " }), (e) => e.status === 400);

  const { rows } = await query(`SELECT estado FROM caja.diferencias_resolucion WHERE id = $1`, [id]);
  assert.equal(rows[0].estado, "PENDIENTE", "no debe resolverla si falta la justificacion");
});

test("TDSI-698: 404 si la diferencia no existe", async () => {
  await assert.rejects(() => resolverDiferencia(999999999, { justificacion: "x" }), (e) => e.status === 404);
});

test("TDSI-698: 409 si ya estaba resuelta", async () => {
  const turnoId = await turnoCerrado();
  const id = await diferenciaPendiente(turnoId);
  await resolverDiferencia(id, { justificacion: "Primera resolucion" });
  await assert.rejects(() => resolverDiferencia(id, { justificacion: "Segundo intento" }), (e) => e.status === 409);
});

test("TDSI-698: si Pub/Sub no responde, la diferencia igual queda resuelta (no se pierde)", async () => {
  const turnoId = await turnoCerrado();
  const id = await diferenciaPendiente(turnoId, { tipo: "SOBRANTE", monto: 8 });

  publisher.usarClienteDePrueba({ topic: () => ({ publishMessage: async () => { throw new Error("el topico no existe"); } }) });
  try {
    const r = await resolverDiferencia(id, { justificacion: "Sobró un billete de la caja chica" });
    assert.equal(r.diferencia.estado, "RESUELTA");
    assert.equal(r.contabilidad.publicado, false);
    assert.match(r.contabilidad.error, /el topico no existe/);
  } finally {
    publisher.usarClienteDePrueba({ topic: () => ({ publishMessage: async () => "pub-698-1" }) });
  }

  const { rows } = await query(`SELECT estado FROM caja.diferencias_resolucion WHERE id = $1`, [id]);
  assert.equal(rows[0].estado, "RESUELTA");
});

test("TDSI-698: POST /api/caja/diferencias/:id/resolver", async () => {
  const turnoId = await turnoCerrado();
  const id = await diferenciaPendiente(turnoId);

  const r = await fetch(`${base}/diferencias/${id}/resolver`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ justificacion: "Se verificó con el cajero", resuelta_por: "admin1" }),
  });
  assert.equal(r.status, 200);
  const cuerpo = await r.json();
  assert.equal(cuerpo.ok, true);
  assert.equal(cuerpo.data.diferencia.estado, "RESUELTA");
  assert.equal(cuerpo.data.contabilidad.publicado, true);

  const segundoIntento = await fetch(`${base}/diferencias/${id}/resolver`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ justificacion: "Otro intento" }),
  });
  assert.equal(segundoIntento.status, 409, "ya estaba resuelta por el request anterior");
});
