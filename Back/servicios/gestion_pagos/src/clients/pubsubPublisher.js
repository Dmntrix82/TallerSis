// TDSI-51/684: publica el aviso de factura emitida en "pagos-facturas-emitidas", para
// que el Marketplace se lo muestre al comprador. No espera a que el Marketplace lo lea:
// Pub/Sub confirma que guardo el mensaje y devuelve su messageId. Mismo patron que el
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

function obtenerTopico() {
  if (!cliente) cliente = crearCliente();
  if (!topicos.has(cfg.FACTURAS_TOPIC)) {
    topicos.set(cfg.FACTURAS_TOPIC, cliente.topic(cfg.FACTURAS_TOPIC, { batching: { maxMessages: 1, maxMilliseconds: 0 } }));
  }
  return topicos.get(cfg.FACTURAS_TOPIC);
}

function conTiempoLimite(promesa, ms) {
  let timer;
  const limite = new Promise((_, rechazar) => {
    timer = setTimeout(() => rechazar(Object.assign(new Error(`Pub/Sub no respondio en ${ms} ms`), { tiempoAgotado: true })), ms);
  });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(timer));
}

/** Publica `mensaje` como JSON. Devuelve { ok: true, messageId } o { ok: false, error }. */
async function publicar(mensaje, atributos = {}) {
  if (!cfg.FACTURAS_TOPIC) return { ok: false, error: "MARKETPLACE_FACTURAS_TOPIC no esta configurado" };

  const attributes = Object.fromEntries(
    Object.entries(atributos).filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => [k, String(v)])
  );
  try {
    const messageId = await conTiempoLimite(obtenerTopico().publishMessage({ json: mensaje, attributes }), cfg.PUBSUB_TIMEOUT_MS);
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
