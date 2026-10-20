// TDSI-22: publica mensajes para Contabilidad en su topico de Pub/Sub (Grupo D).
// No espera a que Contabilidad los procese: Pub/Sub confirma que guardo el mensaje
// y devuelve su messageId.
const { PubSub } = require("@google-cloud/pubsub");
const cfg = require("../config/contabilidad");

// Codigos gRPC que no se arreglan reintentando: argumento invalido, topico
// inexistente, sin permiso, sin autenticacion.
const NO_REINTENTABLES = new Set([3, 5, 7, 16]);

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
  if (!topicos.has(cfg.PUBSUB_TOPIC)) {
    topicos.set(cfg.PUBSUB_TOPIC, cliente.topic(cfg.PUBSUB_TOPIC, { batching: { maxMessages: 1, maxMilliseconds: 0 } }));
  }
  return topicos.get(cfg.PUBSUB_TOPIC);
}

function conTiempoLimite(promesa, ms) {
  let timer;
  const limite = new Promise((_, rechazar) => {
    timer = setTimeout(() => rechazar(Object.assign(new Error(`Pub/Sub no respondio en ${ms} ms`), { tiempoAgotado: true })), ms);
  });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(timer));
}

/** Publica `mensaje` como JSON. Devuelve { ok: true, messageId } o { ok: false, reintentable, error }. */
async function publicar(mensaje, atributos = {}) {
  if (!cfg.PUBSUB_TOPIC) return { ok: false, reintentable: false, error: "CONTABILIDAD_PUBSUB_TOPIC no esta configurado" };

  const attributes = Object.fromEntries(
    Object.entries(atributos).filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => [k, String(v)])
  );
  try {
    const messageId = await conTiempoLimite(obtenerTopico().publishMessage({ json: mensaje, attributes }), cfg.PUBSUB_TIMEOUT_MS);
    return { ok: true, messageId };
  } catch (e) {
    const reintentable = e.tiempoAgotado || !NO_REINTENTABLES.has(e.code);
    return { ok: false, reintentable, error: `Pub/Sub: ${e.message}`.slice(0, 400) };
  }
}

/** Revisa, sin publicar, que la cuenta de servicio pueda publicar en el topico. */
async function verificarPermiso() {
  try {
    const [permisos] = await conTiempoLimite(obtenerTopico().iam.testPermissions(["pubsub.topics.publish"]), cfg.PUBSUB_TIMEOUT_MS);
    if (permisos["pubsub.topics.publish"]) return { ok: true };
    return { ok: false, error: "La cuenta de servicio no tiene permiso para publicar en el topico (rol Pub/Sub Publisher)" };
  } catch (e) {
    return { ok: false, error: `Pub/Sub: ${e.message}` };
  }
}

/** Solo para pruebas: reemplaza el cliente real por uno simulado (null vuelve al real). */
function usarClienteDePrueba(falso) {
  cliente = falso;
  topicos.clear();
}

module.exports = { publicar, verificarPermiso, usarClienteDePrueba };
