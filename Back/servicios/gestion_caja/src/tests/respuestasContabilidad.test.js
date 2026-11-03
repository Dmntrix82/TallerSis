// TDSI-52/700: lectura de las respuestas de Contabilidad (resultado_documento) para
// referencias DIF-<id>, con Pub/Sub simulado. BD real; limpia lo que crea.
process.env.CONTABILIDAD_RESPUESTAS_SUBSCRIPTION = "projects/proyecto-prueba/subscriptions/sub-a";

const test = require("node:test");
const assert = require("node:assert/strict");
const { query } = require("../config/db");
const { interpretar } = require("../services/respuestasContabilidadService");
const { procesarRespuestas } = require("../jobs/respuestasContabilidad");
const subscriber = require("../clients/pubsubSubscriber");

const CAJA = "CAJA-TEST-700";
let contadorTurnos = 0;

const resultado = (referencia, extra = {}) =>
  JSON.stringify({ sistema_origen: "CONTABILIDAD", tipo_mensaje: "resultado_documento", referencia_externa: referencia, ...extra });

// Suscripcion simulada: entrega los mensajes dados y registra que se confirmo y que se libero.
function suscripcionFalsa(textos) {
  const falsa = { confirmados: [], liberados: [] };
  falsa.pull = async () => [{
    receivedMessages: textos.map((t, i) => ({
      ackId: `ack-${i}`,
      message: { messageId: `m-${i}`, data: Buffer.from(t), attributes: {}, publishTime: { seconds: 1760900000, nanos: 0 } },
    })),
  }];
  falsa.acknowledge = async ({ ackIds }) => falsa.confirmados.push(...ackIds);
  falsa.modifyAckDeadline = async ({ ackIds }) => falsa.liberados.push(...ackIds);
  falsa.close = async () => {};
  return falsa;
}

async function limpiar() {
  await query(`DELETE FROM caja.diferencias_resolucion WHERE turno_id IN (SELECT id FROM caja.turnos WHERE caja_id = $1)`, [CAJA]);
  await query(`DELETE FROM caja.turnos WHERE caja_id = $1`, [CAJA]);
  await query(`DELETE FROM caja.cajas WHERE codigo = $1`, [CAJA]);
}

/** Diferencia ya resuelta con su envio en estado 'Enviado' -- lista para recibir una respuesta. */
async function envioEnviado() {
  contadorTurnos += 1;
  const { rows: turnoRows } = await query(
    `INSERT INTO caja.turnos (codigo, caja_id, cajero_id, efectivo_inicial, estado, abierto_en, cerrado_en)
     VALUES ($1, $2, 'CAJ-700', 100, 'CERRADO', now(), now()) RETURNING id`,
    [`TUR-TEST-700-${contadorTurnos}`, CAJA]
  );
  const { rows: difRows } = await query(
    `INSERT INTO caja.diferencias_resolucion (turno_id, monto, tipo, justificacion, estado, resuelta_en)
     VALUES ($1, 12, 'FALTANTE', 'x', 'RESUELTA', now()) RETURNING id`,
    [turnoRows[0].id]
  );
  const diferenciaId = Number(difRows[0].id);
  await query(
    `INSERT INTO caja.diferencias_envios_contabilidad (diferencia_id, estado, pubsub_message_id, enviado_en)
     VALUES ($1, 'Enviado', 'pub-previo', now())`,
    [diferenciaId]
  );
  return diferenciaId;
}

test.before(async () => {
  await limpiar();
  await query(`INSERT INTO caja.cajas (codigo, nombre, estado) VALUES ($1, 'Caja Test 700', 'ACTIVA')`, [CAJA]);
});
test.after(async () => {
  subscriber.usarClienteDePrueba(null);
  await limpiar();
});

test("TDSI-700: interpreta el resultado_documento de Contabilidad para referencias DIF-<id>", () => {
  assert.deepEqual(interpretar(resultado("DIF-123", { estado: "aceptado" })), {
    referencia: "DIF-123", diferenciaId: 123, estado: "Confirmado", motivo: null,
  });
  const rechazo = interpretar(resultado("DIF-55", { estado: "RECHAZADO", motivo: "Falta autorizacion del supervisor" }));
  assert.deepEqual(rechazo, { referencia: "DIF-55", diferenciaId: 55, estado: "Rechazado", motivo: "Falta autorizacion del supervisor" });

  assert.equal(interpretar("no es json"), null);
  assert.equal(interpretar(JSON.stringify({ tipo: "REPORTE_CIERRE_DIARIO" })), null); // otro mensaje del topico A
  assert.equal(interpretar(resultado("F-000001", { estado: "aceptado" })), null); // referencia de facturacion, no nuestra
  assert.equal(interpretar(resultado("DIF-123", { estado: "en_revision" })), null); // resultado que no reconocemos
});

test("TDSI-700: guarda el resultado y confirma solo las respuestas de nuestras diferencias", async () => {
  const id = await envioEnviado();
  subscriber.usarClienteDePrueba(suscripcionFalsa([
    resultado(`DIF-${id}`, { estado: "aceptado" }),
    JSON.stringify({ tipo: "REPORTE_CIERRE_DIARIO", version: 2 }), // otro mensaje del topico A
    resultado("F-000001", { estado: "aceptado" }), // respuesta de una factura (de facturacion)
    resultado("DIF-999999999", { estado: "aceptado" }), // diferencia que no es de esta base
  ]));

  const resultados = await procesarRespuestas();
  assert.equal(resultados.length, 1);
  assert.equal(resultados[0].referencia, `DIF-${id}`);
  assert.equal(resultados[0].estado, "Confirmado");

  const { rows } = await query(
    `SELECT estado, motivo_rechazo, respondido_en IS NOT NULL AS con_fecha FROM caja.diferencias_envios_contabilidad WHERE diferencia_id = $1`,
    [id]
  );
  assert.deepEqual(rows[0], { estado: "Confirmado", motivo_rechazo: null, con_fecha: true });
});

test("TDSI-700: un rechazo guarda el motivo; los mensajes que no son nuestros se liberan sin confirmarlos", async () => {
  const id = await envioEnviado();
  const falsa = suscripcionFalsa([
    JSON.stringify({ otro: true }),
    resultado(`DIF-${id}`, { estado: "rechazado", motivo: "NIT invalido para el periodo" }),
  ]);
  subscriber.usarClienteDePrueba(falsa);

  await procesarRespuestas();
  assert.deepEqual(falsa.confirmados, ["ack-1"]);
  assert.deepEqual(falsa.liberados, ["ack-0"]);

  const { rows } = await query(`SELECT estado, motivo_rechazo FROM caja.diferencias_envios_contabilidad WHERE diferencia_id = $1`, [id]);
  assert.equal(rows[0].estado, "Rechazado");
  assert.equal(rows[0].motivo_rechazo, "NIT invalido para el periodo");
});

test("TDSI-700: una respuesta repetida (el envio ya estaba Confirmado/Rechazado) no se confirma como propia de nuevo", async () => {
  const id = await envioEnviado();
  subscriber.usarClienteDePrueba(suscripcionFalsa([resultado(`DIF-${id}`, { estado: "aceptado" })]));
  await procesarRespuestas();

  const falsa = suscripcionFalsa([resultado(`DIF-${id}`, { estado: "aceptado" })]);
  subscriber.usarClienteDePrueba(falsa);
  const resultados = await procesarRespuestas();
  assert.equal(resultados.length, 0);
  assert.deepEqual(falsa.liberados, ["ack-0"]);
});
