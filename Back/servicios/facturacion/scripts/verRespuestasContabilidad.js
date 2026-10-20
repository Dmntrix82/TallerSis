// TDSI-22: muestra las respuestas que Contabilidad publica en el topico del Grupo A
// (resultado_documento: aceptado con su numero de asiento, o rechazado con su motivo).
//
//   npm run contabilidad:respuestas                 -> solo mirar: no confirma nada, los mensajes siguen ahi
//   npm run contabilidad:respuestas -- --max=50     -> lee hasta 50 mensajes (por defecto 10)
//   npm run contabilidad:respuestas -- --guardar    -> guarda el resultado en factura_envios_contabilidad y
//                                                      confirma solo las respuestas de nuestras facturas
//                                                      (lo mismo que hace el servicio cada 30 s)
//
// .env: CONTABILIDAD_RESPUESTAS_SUBSCRIPTION=<suscripcion Pull del topico A> (nombre corto o completo).
// La cuenta de servicio necesita el rol "Suscriptor de Pub/Sub" en esa suscripcion.
require("dotenv").config();
const { PubSub } = require("@google-cloud/pubsub");
const cfg = require("../src/config/contabilidad");
const subscriber = require("../src/clients/pubsubSubscriber");
const { interpretar } = require("../src/services/respuestasContabilidadService");

const args = process.argv.slice(2);
const guardar = args.includes("--guardar");
const max = Math.min(Math.max(Number((args.find((a) => a.startsWith("--max=")) || "").slice(6)) || 10, 1), 100);

async function listarSuscripciones() {
  const cred = cfg.GOOGLE_CREDENTIALS;
  const proyecto = cred?.project_id || (cfg.PUBSUB_TOPIC || "").split("/")[1];
  const topico = process.env.CONTABILIDAD_RESPUESTAS_TOPIC || `projects/${proyecto}/topics/ucb-sis323-sub-a`;
  console.log(`Falta CONTABILIDAD_RESPUESTAS_SUBSCRIPTION. Suscripciones de ${topico}:`);
  try {
    const opciones = cred ? { projectId: cred.project_id, credentials: { client_email: cred.client_email, private_key: cred.private_key } } : {};
    const [subs] = await new PubSub(opciones).topic(topico).getSubscriptions();
    for (const s of subs) console.log(`  ${s.name}`);
    if (!subs.length) console.log("  (ninguna)");
  } catch (e) {
    console.log(`  No se pudieron listar (${e.message}).`);
    console.log("  Pidan el nombre de la suscripcion al docente: listar requiere un permiso que esta cuenta no tiene.");
  }
}

async function mirar() {
  const mensajes = await subscriber.leer(max);
  console.log(`Suscripcion: ${subscriber.nombreSuscripcion()}\nMensajes leidos: ${mensajes.length} (no se confirma ninguno)\n`);
  for (const m of mensajes) {
    const r = interpretar(m.texto);
    if (r) {
      const detalle = r.resultado === "aceptado" ? `asiento Nº ${r.numeroAsiento}` : `motivo: ${r.motivo}`;
      console.log(`${r.referencia} -> ${r.resultado} (${detalle})   [messageId ${m.messageId}, ${m.publicadoEn}]`);
    } else {
      console.log(`otro mensaje [messageId ${m.messageId}, ${m.publicadoEn}]: ${m.texto.slice(0, 300)}`);
    }
  }
  await subscriber.liberar(mensajes.map((m) => m.ackId));
}

async function guardarRespuestas() {
  const { procesarRespuestas } = require("../src/jobs/respuestasContabilidad");
  const resultados = await procesarRespuestas();
  console.log(`Respuestas de nuestras facturas guardadas y confirmadas: ${resultados.length}`);
  for (const r of resultados) console.log(`  ${r.referencia} -> ${r.resultado}${r.envio.numero_asiento ? ` (asiento Nº ${r.envio.numero_asiento})` : ""}`);
  await require("../src/config/db").pool.end();
}

(async () => {
  if (!cfg.GOOGLE_CREDENTIALS && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error("Falta GOOGLE_CREDENTIALS_JSON o GOOGLE_APPLICATION_CREDENTIALS en el .env");
    process.exit(1);
  }
  if (!cfg.RESPUESTAS_SUBSCRIPTION) await listarSuscripciones();
  else if (guardar) await guardarRespuestas();
  else await mirar();
  await subscriber.cerrar();
})().catch((e) => {
  const ayuda = e.code === 7 ? " -> la cuenta de servicio necesita el rol Suscriptor de Pub/Sub en esa suscripcion"
    : e.code === 5 ? " -> la suscripcion no existe; revisen el nombre" : "";
  console.error(`Pub/Sub: ${e.message}${ayuda}`);
  process.exit(1);
});
