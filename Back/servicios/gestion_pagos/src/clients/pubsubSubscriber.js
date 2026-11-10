// Suscriptor Pub/Sub generico de gestion_pagos, compartido por las integraciones con
// el Marketplace (TDSI-51/179, suscripcion de "marketplace-ventas") y con Compras
// (TDSI-54/697, suscripcion de "compras-acuses"): cada una resuelve su propia
// suscripcion con nombreSuscripcion() y se la pasa a leer()/confirmar()/liberar().
// Las credenciales (GOOGLE_CREDENTIALS_JSON) y el timeout (PUBSUB_TIMEOUT_MS) son los
// mismos para todo el servicio -- da igual de que config se lean, marketplace.js y
// compras.js definen las mismas variables.
const { v1 } = require("@google-cloud/pubsub");
const cfg = require("../config/marketplace");

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
function nombreSuscripcion(suscripcion) {
  if (!suscripcion) return null;
  if (suscripcion.includes("/topics/"))
    throw new Error("La suscripcion configurada tiene un topico; debe ser una suscripcion (projects/<p>/subscriptions/<nombre> o solo <nombre>)");
  if (suscripcion.startsWith("projects/")) return suscripcion;
  const proyecto = cfg.GOOGLE_CREDENTIALS?.project_id;
  return `projects/${proyecto}/subscriptions/${suscripcion}`;
}

/** Trae hasta `max` mensajes de `suscripcion`: [{ ackId, messageId, publicadoEn, atributos, texto }]. */
async function leer(max = 50, suscripcion) {
  // returnImmediately: sin esto, pull() se queda esperando mensajes que no llegan (el
  // caso normal) y revienta con DEADLINE_EXCEEDED en vez de devolver una lista vacia.
  const [respuesta] = await obtenerCliente().pull({ subscription: suscripcion, maxMessages: max, returnImmediately: true }, { timeout: cfg.PUBSUB_TIMEOUT_MS });
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

/** Confirma los mensajes procesados de `suscripcion` (desaparecen de la suscripcion). */
async function confirmar(ackIds, suscripcion) {
  if (ackIds.length) await obtenerCliente().acknowledge({ subscription: suscripcion, ackIds });
}

/** Libera de inmediato los mensajes que no son para este servicio, para que otros los lean. */
async function liberar(ackIds, suscripcion) {
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
