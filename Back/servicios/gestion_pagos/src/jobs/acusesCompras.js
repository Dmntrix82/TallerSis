const subscriber = require("../clients/pubsubSubscriber");
const { procesarMensaje } = require("../services/acusesComprasService");
const cfg = require("../config/compras");

let enCurso = false;
let ultimoError = null;

/**
 * TDSI-54/697: lee la suscripcion de "compras-acuses" y marca Recibido el envio de
 * nuestras referencias PV-<fecha>. El resto de los mensajes (si el topico se comparte
 * con algo mas) se liberan sin confirmar, para no quitarselos a quien le toque.
 */
async function procesarAcuses() {
  if (enCurso || !cfg.ACUSES_SUBSCRIPTION) return [];
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
          console.log(`[compras] ${r.reporteId} -> Recibido`);
        }
      } catch (e) {
        liberar.push(m.ackId); // se vuelve a intentar en la siguiente lectura
        console.error(`[compras] No se pudo procesar el acuse ${m.messageId}:`, e.message);
      }
    }
    await subscriber.confirmar(confirmar);
    await subscriber.liberar(liberar);
    ultimoError = null;
  } catch (e) {
    if (e.message !== ultimoError) console.error("[compras] No se pudieron leer los acuses:", e.message);
    ultimoError = e.message;
  } finally {
    enCurso = false;
  }
  return resultados;
}

function iniciar() {
  if (!cfg.ACUSES_SUBSCRIPTION) return;
  try {
    subscriber.nombreSuscripcion();
  } catch (e) {
    console.error(`[compras] No se leen los acuses: ${e.message}`); // configuracion invalida: el servicio sigue
    return;
  }
  const timer = setInterval(procesarAcuses, cfg.ACUSES_INTERVALO_SEG * 1000);
  timer.unref();
  console.log(`[compras] Leyendo acuses de ${subscriber.nombreSuscripcion()} cada ${cfg.ACUSES_INTERVALO_SEG} s`);
}

module.exports = { iniciar, procesarAcuses };
