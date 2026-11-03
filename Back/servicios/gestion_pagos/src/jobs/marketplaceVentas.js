const subscriber = require("../clients/pubsubSubscriber");
const { recibirVenta } = require("../services/ventaOnlineService");
const ventasOnlineRepo = require("../data/ventasOnlineRepo");
const cfg = require("../config/marketplace");

let enCurso = false;
let ultimoError = null;

/**
 * TDSI-51/179: lee la suscripcion de "marketplace-ventas" y pasa cada mensaje a la
 * validacion de venta online. El topico es nuestro (nadie mas lo lee), asi que TODO
 * mensaje se confirma (ack) despues de procesarlo -- los validos porque ya quedaron
 * guardados (o eran un duplicado, TDSI-51), y los invalidos porque nunca van a poder
 * procesarse (se guarda el error para revisarlo, no tiene sentido reintentarlos).
 */
async function procesarVentas() {
  if (enCurso || !cfg.VENTAS_SUBSCRIPTION) return [];
  enCurso = true;
  const resultados = [];
  try {
    const mensajes = await subscriber.leer(50);
    const confirmar = [];
    for (const m of mensajes) {
      confirmar.push(m.ackId);
      try {
        const json = JSON.parse(m.texto);
        const r = await recibirVenta(json);
        resultados.push(r);
        console.log(`[marketplace] ${r.ordenId} -> ${r.duplicada ? "ya estaba registrada" : "venta guardada"}`);
      } catch (e) {
        await ventasOnlineRepo.registrarMensajeInvalido({ messageId: m.messageId, error: e.message, payload: m.texto });
        console.error(`[marketplace] Mensaje ${m.messageId} invalido, se guardo el error:`, e.message);
      }
    }
    await subscriber.confirmar(confirmar);
    ultimoError = null;
  } catch (e) {
    if (e.message !== ultimoError) console.error("[marketplace] No se pudieron leer las ventas:", e.message);
    ultimoError = e.message;
  } finally {
    enCurso = false;
  }
  return resultados;
}

function iniciar() {
  if (!cfg.VENTAS_SUBSCRIPTION) return;
  try {
    subscriber.nombreSuscripcion();
  } catch (e) {
    console.error(`[marketplace] No se leen las ventas: ${e.message}`); // configuracion invalida: el servicio sigue
    return;
  }
  const timer = setInterval(procesarVentas, cfg.VENTAS_INTERVALO_SEG * 1000);
  timer.unref();
  console.log(`[marketplace] Leyendo ventas de ${subscriber.nombreSuscripcion()} cada ${cfg.VENTAS_INTERVALO_SEG} s`);
}

module.exports = { iniciar, procesarVentas };
