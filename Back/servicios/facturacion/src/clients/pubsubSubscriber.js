// TDSI-22: lectura (pull) de la suscripcion donde Contabilidad publica sus respuestas.
const { v1 } = require("@google-cloud/pubsub");
const cfg = require("../config/contabilidad");

let cliente = null;

function obtenerCliente() {
  if (!cliente) {
    const cred = cfg.GOOGLE_CREDENTIALS;
    cliente = new v1.SubscriberClient(
      cred ? { projectId: cred.project_id, credentials: { client_email: cred.client_email, private_key: cred.private_key } } : {}
    );
  }
  return cliente;
}

/** Nombre completo de la suscripcion: acepta "projects/<p>/subscriptions/<s>" o solo "<s>". */
function nombreSuscripcion(suscripcion = cfg.RESPUESTAS_SUBSCRIPTION) {
  if (!suscripcion) return null;
  if (suscripcion.startsWith("projects/")) return suscripcion;
  const proyecto = cfg.GOOGLE_CREDENTIALS?.project_id || (cfg.PUBSUB_TOPIC || "").split("/")[1];
  return `projects/${proyecto}/subscriptions/${suscripcion}`;
}

/** Trae hasta `max` mensajes: [{ ackId, messageId, publicadoEn, atributos, texto }]. */
async function leer(max = 50, suscripcion = nombreSuscripcion()) {
  const [respuesta] = await obtenerCliente().pull({ subscription: suscripcion, maxMessages: max }, { timeout: 20000 });
  return (respuesta.receivedMessages || []).map(({ ackId, message }) => ({
    ackId,
    messageId: message.messageId,
    publicadoEn: message.publishTime
      ? new Date(Number(message.publishTime.seconds) * 1000 + Math.floor((message.publishTime.nanos || 0) / 1e6)).toISOString()
      : null,
    atributos: message.attributes || {},
    texto: Buffer.from(message.data || "").toString("utf8"),
  }));
}

/** Confirma los mensajes procesados (desaparecen de la suscripcion). */
async function confirmar(ackIds, suscripcion = nombreSuscripcion()) {
  if (ackIds.length) await obtenerCliente().acknowledge({ subscription: suscripcion, ackIds });
}

/** Libera de inmediato los mensajes que no son para este servicio, para que otros los lean. */
async function liberar(ackIds, suscripcion = nombreSuscripcion()) {
  if (ackIds.length) await obtenerCliente().modifyAckDeadline({ subscription: suscripcion, ackIds, ackDeadlineSeconds: 0 });
}

async function cerrar() {
  if (cliente) await cliente.close();
  cliente = null;
}

/** Solo para pruebas: reemplaza el cliente real por uno simulado (null vuelve al real). */
function usarClienteDePrueba(falso) {
  cliente = falso;
}

module.exports = { leer, confirmar, liberar, cerrar, nombreSuscripcion, usarClienteDePrueba };
