// TDSI-52/701: GET /api/caja/diferencias (con el estado del aviso a Contabilidad) y
// POST /api/caja/diferencias/:id/reenviar-contabilidad. Pub/Sub simulado; BD real.
process.env.CONTABILIDAD_PUBSUB_TOPIC = "projects/proyecto-prueba/topics/topico-a";

const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { query } = require("../config/db");
const { errorHandler } = require("../middlewares/errorHandler");
const { resolverDiferencia, listarDiferencias, reenviarContabilidad } = require("../services/diferenciasService");
const publisher = require("../clients/pubsubPublisher");

const CAJA = "CAJA-TEST-701";
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
     VALUES ($1, $2, 'CAJ-701', 'Cajero 701', 100, 'CERRADO', now(), now()) RETURNING id`,
    [`TUR-TEST-701-${contadorTurnos}`, CAJA]
  );
  return Number(rows[0].id);
}

async function diferenciaPendiente(turnoId, { tipo = "FALTANTE", monto = 25 } = {}) {
  const { rows } = await query(
    `INSERT INTO caja.diferencias_resolucion (turno_id, monto, tipo) VALUES ($1, $2, $3) RETURNING id`,
    [turnoId, monto, tipo]
  );
  return Number(rows[0].id);
}

const topicoQuePublicaBien = () => ({ topic: () => ({ publishMessage: async () => "pub-701-ok" }) });
const topicoQueFalla = (motivo) => ({ topic: () => ({ publishMessage: async () => { throw new Error(motivo); } }) });

test.before(async () => {
  await limpiar();
  await query(`INSERT INTO caja.cajas (codigo, nombre, estado) VALUES ($1, 'Caja Test 701', 'ACTIVA')`, [CAJA]);

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

test("TDSI-701: lista las diferencias con el estado del aviso a Contabilidad", async () => {
  const turno1 = await turnoCerrado();
  const pendiente = await diferenciaPendiente(turno1, { tipo: "FALTANTE", monto: 30 });

  publisher.usarClienteDePrueba(topicoQuePublicaBien());
  const turno2 = await turnoCerrado();
  const resueltaId = await diferenciaPendiente(turno2, { tipo: "SOBRANTE", monto: 12 });
  await resolverDiferencia(resueltaId, { justificacion: "Se verificó con el cajero" });

  const lista = await listarDiferencias();
  const filaPendiente = lista.find((d) => d.id === pendiente);
  const filaResuelta = lista.find((d) => d.id === resueltaId);

  assert.equal(filaPendiente.estado, "PENDIENTE");
  assert.equal(filaPendiente.contabilidad, null, "todavia no se resolvio, no hay envio");

  assert.equal(filaResuelta.estado, "RESUELTA");
  assert.equal(filaResuelta.caja_id, CAJA);
  assert.equal(filaResuelta.cajero, "Cajero 701");
  assert.deepEqual(filaResuelta.contabilidad, { estado: "Enviado", motivo_rechazo: null, intentos: 1, ultimo_error: null });
});

test("TDSI-701: filtra por estado y valida un estado invalido", async () => {
  const soloPendientes = await listarDiferencias({ estado: "PENDIENTE" });
  assert.ok(soloPendientes.every((d) => d.estado === "PENDIENTE"));

  await assert.rejects(() => listarDiferencias({ estado: "RARO" }), (e) => e.status === 400);
});

test("TDSI-701: reenvia un envio que nunca se pudo publicar, y queda Enviado", async () => {
  const turno = await turnoCerrado();
  const id = await diferenciaPendiente(turno);

  publisher.usarClienteDePrueba(topicoQueFalla("no hay credenciales"));
  const r1 = await resolverDiferencia(id, { justificacion: "Faltó un billete" });
  assert.equal(r1.contabilidad.publicado, false);

  publisher.usarClienteDePrueba(topicoQuePublicaBien());
  const r2 = await reenviarContabilidad(id);
  assert.equal(r2.publicado, true);
  assert.equal(r2.contabilidad.estado, "Enviado");
  assert.equal(r2.contabilidad.intentos, 2);

  const lista = await listarDiferencias();
  const fila = lista.find((d) => d.id === id);
  assert.equal(fila.contabilidad.estado, "Enviado");
});

test("TDSI-701: no deja reenviar un envio ya Enviado o sin resolver", async () => {
  const turnoSinResolver = await turnoCerrado();
  const sinResolver = await diferenciaPendiente(turnoSinResolver);
  await assert.rejects(() => reenviarContabilidad(sinResolver), (e) => e.status === 404);

  publisher.usarClienteDePrueba(topicoQuePublicaBien());
  const turno = await turnoCerrado();
  const id = await diferenciaPendiente(turno);
  await resolverDiferencia(id, { justificacion: "Todo cuadró a la segunda" });
  await assert.rejects(() => reenviarContabilidad(id), (e) => e.status === 409);
});

test("TDSI-701: GET /api/caja/diferencias y POST reenviar-contabilidad", async () => {
  const turno = await turnoCerrado();
  const id = await diferenciaPendiente(turno);

  publisher.usarClienteDePrueba(topicoQueFalla("sin conexion"));
  await resolverDiferencia(id, { justificacion: "Se revisó la caja chica" });

  const lista = await fetch(`${base}/diferencias?estado=RESUELTA`);
  assert.equal(lista.status, 200);
  const { data } = await lista.json();
  const fila = data.find((d) => d.id === id);
  assert.equal(fila.contabilidad.estado, "Pendiente");

  publisher.usarClienteDePrueba(topicoQuePublicaBien());
  const reenvio = await fetch(`${base}/diferencias/${id}/reenviar-contabilidad`, { method: "POST" });
  assert.equal(reenvio.status, 200);
  const cuerpo = await reenvio.json();
  assert.equal(cuerpo.data.publicado, true);
  assert.equal(cuerpo.data.contabilidad.estado, "Enviado");
});
