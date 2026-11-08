const subscriber = require("../clients/pubsubSubscriber");
const { procesarMensaje } = require("../services/respuestasContabilidadService");
const cfg = require("../config/contabilidad");

let enCurso = false;
let ultimoError = null;

/**
 * TDSI-52/700: lee la suscripcion de respuestas de Contabilidad, guarda el resultado
 * (Confirmado/Rechazado) de nuestras diferencias (referencias DIF-<id>) y lo confirma
 * (ack). Los demas mensajes del topico se liberan sin confirmar, para no quitarselos a
 * quien mas lea esa suscripcion (p.ej. facturacion, con sus propias referencias F-NNNNNN).
 */
async function procesarRespuestas() {
  if (enCurso || !cfg.RESPUESTAS_SUBSCRIPTION) return [];
  enCurso = true;
  const resultados = [];
  try {
    const mensajes = await subscriber.leer(50);
    const confirmar = [];
    const liberar = [];
    for (const m of mensajes) {
      try {
        const r = await procesarMensaje(m);
        (r.propio ? confirmar : liberar).push(m.ackId);
        if (r.propio) {
          resultados.push(r);
          console.log(`[contabilidad] ${r.referencia} -> ${r.estado}`);
        }
      } catch (e) {
        liberar.push(m.ackId); // se vuelve a intentar en la siguiente lectura
        console.error(`[contabilidad] No se pudo guardar la respuesta ${m.messageId}:`, e.message);
      }
    }
    await subscriber.confirmar(confirmar);
    await subscriber.liberar(liberar);
    ultimoError = null;
  } catch (e) {
    if (e.message !== ultimoError) console.error("[contabilidad] No se pudieron leer las respuestas:", e.message);
    ultimoError = e.message;
  } finally {
    enCurso = false;
  }
  return resultados;
}

function iniciar() {
  if (!cfg.RESPUESTAS_SUBSCRIPTION) return;
  try {
    subscriber.nombreSuscripcion();
  } catch (e) {
    console.error(`[contabilidad] No se leen las respuestas: ${e.message}`); // configuracion invalida: el servicio sigue
    return;
  }
  const timer = setInterval(procesarRespuestas, cfg.RESPUESTAS_INTERVALO_SEG * 1000);
  timer.unref();
  console.log(`[contabilidad] Leyendo respuestas de ${subscriber.nombreSuscripcion()} cada ${cfg.RESPUESTAS_INTERVALO_SEG} s`);
}

module.exports = { iniciar, procesarRespuestas };
