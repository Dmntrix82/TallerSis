// Publicador Pub/Sub generico de gestion_pagos, compartido por las integraciones con
// el Marketplace (TDSI-51/684, topico "pagos-facturas-emitidas") y con Compras
// (TDSI-54/682, topico "pagos-productos-vendidos"): cada una pasa su propio topico a
// publicar(). Las credenciales (GOOGLE_CREDENTIALS_JSON) y el timeout (PUBSUB_TIMEOUT_MS)
// son los mismos para todo el servicio -- da igual de que config se lean, marketplace.js
// y compras.js definen las mismas variables. No espera a que lo procesen: Pub/Sub
// confirma que guardo el mensaje y devuelve su messageId. Mismo patron que el
// publicador de facturacion hacia Contabilidad (src/clients/pubsubPublisher.js).
const { PubSub } = require("@google-cloud/pubsub");
const cfg = require("../config/marketplace");

let cliente = null;
const topicos = new Map();

function crearCliente() {
  const cred = cfg.GOOGLE_CREDENTIALS;
  if (!cred) return new PubSub(); // usa GOOGLE_APPLICATION_CREDENTIALS
  return new PubSub({
    projectId: cred.project_id,
    credentials: { client_email: cred.client_email, private_key: cred.private_key },
  });
}

function obtenerTopico(nombreTopico) {
  if (!cliente) cliente = crearCliente();
  if (!topicos.has(nombreTopico)) {
    topicos.set(nombreTopico, cliente.topic(nombreTopico, { batching: { maxMessages: 1, maxMilliseconds: 0 } }));
  }
  return topicos.get(nombreTopico);
}

function conTiempoLimite(promesa, ms) {
  let timer;
  const limite = new Promise((_, rechazar) => {
    timer = setTimeout(() => rechazar(Object.assign(new Error(`Pub/Sub no respondio en ${ms} ms`), { tiempoAgotado: true })), ms);
  });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(timer));
}

/** Publica `mensaje` como JSON en `nombreTopico`. Devuelve { ok: true, messageId } o { ok: false, error }. */
async function publicar(nombreTopico, mensaje, atributos = {}) {
  if (!nombreTopico) return { ok: false, error: "El topico de Pub/Sub no esta configurado" };

  const attributes = Object.fromEntries(
    Object.entries(atributos).filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => [k, String(v)])
  );
  try {
    const messageId = await conTiempoLimite(obtenerTopico(nombreTopico).publishMessage({ json: mensaje, attributes }), cfg.PUBSUB_TIMEOUT_MS);
    return { ok: true, messageId };
  } catch (e) {
    return { ok: false, error: `Pub/Sub: ${e.message}`.slice(0, 400) };
  }
}

/** Solo para pruebas: reemplaza el cliente real por uno simulado (null vuelve al real). */
function usarClienteDePrueba(falso) {
  cliente = falso;
  topicos.clear();
}

module.exports = { publicar, usarClienteDePrueba };
