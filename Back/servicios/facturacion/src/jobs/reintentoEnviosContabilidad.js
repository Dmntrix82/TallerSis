const repo = require("../data/enviosContabilidadRepo");
const { intentarEnvio } = require("../services/contabilidadService");
const cfg = require("../config/contabilidad");

let enCurso = false;

/** TDSI-22: reintenta los envios de facturas a Contabilidad que quedaron Pendientes. */
async function procesarPendientes(opciones = {}) {
  if (enCurso) return [];
  enCurso = true;
  const resultados = [];
  try {
    for (const envio of await repo.tomarPendientes(10, opciones)) {
      const r = await intentarEnvio(envio);
      resultados.push(r);
      if (r.estado !== "Enviado")
        console.warn(`[contabilidad] Envio ${r.id} (${r.tipo} ${r.factura_numero}) intento ${r.intentos} -> ${r.estado}: ${r.ultimo_error}`);
    }
  } catch (e) {
    console.error("[contabilidad] Error procesando envios pendientes:", e.message);
  } finally {
    enCurso = false;
  }
  return resultados;
}

function iniciar() {
  if (!cfg.PUBSUB_TOPIC) {
    console.log("[contabilidad] CONTABILIDAD_PUBSUB_TOPIC vacio: las facturas no se envian a Contabilidad");
    return;
  }
  const timer = setInterval(procesarPendientes, cfg.INTERVALO_WORKER_SEG * 1000);
  timer.unref();
  console.log(`[contabilidad] Facturas -> Pub/Sub (${cfg.PUBSUB_TOPIC}), reintentos cada ${cfg.INTERVALO_WORKER_SEG} s`);
}

module.exports = { iniciar, procesarPendientes };
