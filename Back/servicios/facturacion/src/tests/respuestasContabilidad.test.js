// TDSI-22: lectura de las respuestas de Contabilidad (resultado_documento) con Pub/Sub simulado.
// Usa la base real; las facturas de prueba se borran al final.
process.env.CONTABILIDAD_PUBSUB_TOPIC = "projects/proyecto-prueba/topics/topico-d";
process.env.CONTABILIDAD_RESPUESTAS_SUBSCRIPTION = "projects/proyecto-prueba/subscriptions/sub-a";

const test = require("node:test");
const assert = require("node:assert/strict");
const facturasService = require("../services/facturasService");
const contabilidad = require("../services/contabilidadService");
const { interpretar } = require("../services/respuestasContabilidadService");
const { procesarRespuestas } = require("../jobs/respuestasContabilidad");
const publisher = require("../clients/pubsubPublisher");
const subscriber = require("../clients/pubsubSubscriber");
const { pool } = require("../config/db");

const creadas = [];
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

async function facturaEnviada() {
  const f = await facturasService.crearFactura({
    nit: "7700112233", razon_social: "Cliente Prueba", items: [{ descripcion: "Item", cantidad: 1, precio_unitario: 35 }],
  });
  creadas.push(f.id);
  await contabilidad.enviarFactura(f.id, "venta");
  return f;
}

test.before(() => {
  publisher.usarClienteDePrueba({ topic: () => ({ publishMessage: async () => "pub-1" }) });
});
test.after(async () => {
  publisher.usarClienteDePrueba(null);
  subscriber.usarClienteDePrueba(null);
  if (creadas.length) await pool.query(`DELETE FROM facturacion.facturas WHERE id = ANY($1::bigint[])`, [creadas]);
  await pool.end();
});

test("TDSI-22: interpreta el resultado_documento de Contabilidad para ventas y anulaciones", () => {
  assert.deepEqual(interpretar(resultado("F-000001", { estado: "aceptado", numero_asiento: 16 })), {
    referencia: "F-000001", facturaNumero: "F-000001", tipo: "venta", resultado: "aceptado", numeroAsiento: "16", motivo: null,
  });
  const anulacion = interpretar(resultado("ANU-F-000001", { estado: "rechazado", motivo: "La venta original no existe" }));
  assert.equal(anulacion.tipo, "anulacion");
  assert.equal(anulacion.facturaNumero, "F-000001");
  assert.equal(anulacion.motivo, "La venta original no existe");

  assert.equal(interpretar("no es json"), null);
  assert.equal(interpretar(JSON.stringify({ tipo: "REPORTE_CIERRE_DIARIO" })), null); // nuestro propio reporte
  assert.equal(interpretar(resultado("OC-123", { estado: "aceptado" })), null); // referencia que no es una factura
});

test("TDSI-22: guarda el resultado en el envio y confirma solo las respuestas de nuestras facturas", async () => {
  const f = await facturaEnviada();
  subscriber.usarClienteDePrueba(suscripcionFalsa([
    resultado(f.numero, { estado: "aceptado", numero_asiento: 16 }),
    JSON.stringify({ tipo: "REPORTE_CIERRE_DIARIO", version: 2 }), // otro mensaje del topico A
    resultado("F-999999", { estado: "aceptado", numero_asiento: 99 }), // factura que no es de esta base
  ]));

  const resultados = await procesarRespuestas();
  assert.equal(resultados.length, 1);
  assert.equal(resultados[0].referencia, f.numero);

  const { rows } = await pool.query(
    `SELECT resultado, numero_asiento, resultado_message_id, resultado_en IS NOT NULL AS con_fecha
     FROM facturacion.factura_envios_contabilidad WHERE factura_id = $1 AND tipo = 'venta'`, [f.id]);
  assert.deepEqual(rows[0], { resultado: "aceptado", numero_asiento: "16", resultado_message_id: "m-0", con_fecha: true });
});

test("TDSI-22: los mensajes que no son nuestros se liberan sin confirmarlos", async () => {
  const f = await facturaEnviada();
  const falsa = suscripcionFalsa([
    JSON.stringify({ otro: true }),
    resultado(`ANU-${f.numero}`, { estado: "rechazado", motivo: "No hay anulacion enviada" }), // no existe envio de anulacion
    resultado(f.numero, { estado: "rechazado", motivo: "NIT invalido para el periodo" }),
  ]);
  subscriber.usarClienteDePrueba(falsa);

  await procesarRespuestas();
  assert.deepEqual(falsa.confirmados, ["ack-2"]);
  assert.deepEqual(falsa.liberados, ["ack-0", "ack-1"]);

  const { envios } = await contabilidad.listarEnvios({ tipo: "venta", limite: 200 });
  const envio = envios.find((e) => e.factura_id === Number(f.id));
  assert.equal(envio.resultado, "rechazado");
  assert.equal(envio.resultado_motivo, "NIT invalido para el periodo");
  assert.equal(envio.numero_asiento, null);
});
