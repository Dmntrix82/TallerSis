// TDSI-22: muestra las respuestas que Contabilidad publica en el topico del Grupo A
// (p. ej. resultado_documento con estado "aceptado" y el asiento) leyendo una suscripcion Pull.
//
//   npm run contabilidad:respuestas              -> lee hasta 10 mensajes y los deja en la suscripcion
//   npm run contabilidad:respuestas -- --max=50  -> lee hasta 50
//   npm run contabilidad:respuestas -- --ack     -> ademas los confirma (desaparecen de la suscripcion)
//
// .env: CONTABILIDAD_RESPUESTAS_SUBSCRIPTION=projects/<proyecto>/subscriptions/<nombre>
// Sin esa variable lista las suscripciones de CONTABILIDAD_RESPUESTAS_TOPIC para encontrar el nombre.
// La cuenta de servicio necesita el rol "Suscriptor de Pub/Sub" en esa suscripcion.
require("dotenv").config();
const { PubSub, v1 } = require("@google-cloud/pubsub");
const cfg = require("../src/config/contabilidad");

const args = process.argv.slice(2);
const confirmar = args.includes("--ack");
const max = Math.min(Math.max(Number((args.find((a) => a.startsWith("--max=")) || "").slice(6)) || 10, 1), 100);

const cred = cfg.GOOGLE_CREDENTIALS;
const opciones = cred
  ? { projectId: cred.project_id, credentials: { client_email: cred.client_email, private_key: cred.private_key } }
  : {};
const proyecto = cred?.project_id || (cfg.PUBSUB_TOPIC || "").split("/")[1];
const topicoRespuestas = process.env.CONTABILIDAD_RESPUESTAS_TOPIC || `projects/${proyecto}/topics/ucb-sis323-sub-a`;

function fecha(ts) {
  if (!ts) return "";
  return new Date(Number(ts.seconds) * 1000 + Math.floor((ts.nanos || 0) / 1e6)).toISOString();
}

async function listarSuscripciones() {
  console.log(`Falta CONTABILIDAD_RESPUESTAS_SUBSCRIPTION. Suscripciones de ${topicoRespuestas}:`);
  const [subs] = await new PubSub(opciones).topic(topicoRespuestas).getSubscriptions();
  if (!subs.length) console.log("  (ninguna: pidan al docente o a Contabilidad una suscripcion Pull de este topico)");
  for (const s of subs) console.log(`  ${s.name}`);
  console.log("Copien la que corresponda al .env como CONTABILIDAD_RESPUESTAS_SUBSCRIPTION.");
}

async function leer(suscripcion) {
  const nombre = suscripcion.startsWith("projects/") ? suscripcion : `projects/${proyecto}/subscriptions/${suscripcion}`;
  const cliente = new v1.SubscriberClient(opciones);
  try {
    const [respuesta] = await cliente.pull({ subscription: nombre, maxMessages: max }, { timeout: 20000 });
    const recibidos = respuesta.receivedMessages || [];
    console.log(`Suscripcion: ${nombre}\nMensajes leidos: ${recibidos.length}${confirmar ? " (se confirmaran)" : " (quedan en la suscripcion)"}\n`);

    for (const { message } of recibidos) {
      const texto = Buffer.from(message.data || "").toString("utf8");
      let cuerpo;
      try { cuerpo = JSON.parse(texto); } catch { cuerpo = texto; }
      console.log(`--- messageId ${message.messageId} · publicado ${fecha(message.publishTime)}`);
      if (message.attributes && Object.keys(message.attributes).length) console.log("atributos:", JSON.stringify(message.attributes));
      console.log(typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo, null, 2));
      console.log();
    }

    const ackIds = recibidos.map((r) => r.ackId);
    if (ackIds.length) {
      if (confirmar) await cliente.acknowledge({ subscription: nombre, ackIds });
      // Sin --ack se liberan de inmediato para que sigan disponibles para los demas.
      else await cliente.modifyAckDeadline({ subscription: nombre, ackIds, ackDeadlineSeconds: 0 });
    }
  } finally {
    await cliente.close();
  }
}

(async () => {
  if (!cred && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error("Falta GOOGLE_CREDENTIALS_JSON o GOOGLE_APPLICATION_CREDENTIALS en el .env");
    process.exit(1);
  }
  const suscripcion = String(process.env.CONTABILIDAD_RESPUESTAS_SUBSCRIPTION || "").trim();
  if (!suscripcion) await listarSuscripciones();
  else await leer(suscripcion);
})().catch((e) => {
  const ayuda = e.code === 7 ? " -> la cuenta de servicio necesita el rol Suscriptor de Pub/Sub en esa suscripcion"
    : e.code === 5 ? " -> la suscripcion (o el topico) no existe; revisen el nombre" : "";
  console.error(`Pub/Sub: ${e.message}${ayuda}`);
  process.exit(1);
});
