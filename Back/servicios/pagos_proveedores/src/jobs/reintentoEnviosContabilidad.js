const enviosRepo = require("../data/enviosContabilidadRepo");
const { intentarEnvio } = require("../services/envioContabilidadService");
const cfg = require("../config/integraciones");

let enCurso = false;

/** TDSI-422: reintenta los envios a Contabilidad que quedaron PENDIENTES. */
async function procesarPendientes(opciones = {}) {
  if (enCurso) return [];
  enCurso = true;
  const resultados = [];
  try {
    const pendientes = await enviosRepo.tomarPendientes(10, opciones);
    for (const envio of pendientes) {
      const r = await intentarEnvio(envio);
      resultados.push(r);
      if (r.estado === "ENVIADO") {
        console.log(`[contabilidad] Envio ${r.id} (lote ${r.fecha}) enviado en el intento ${r.intentos}`);
      } else {
        console.warn(`[contabilidad] Envio ${r.id} (lote ${r.fecha}) fallo, intento ${r.intentos} -> ${r.estado}: ${r.ultimo_error}`);
      }
    }
  } catch (e) {
    console.error("[contabilidad] Error procesando envios pendientes:", e.message);
  } finally {
    enCurso = false;
  }
  return resultados;
}

function iniciar() {
  const timer = setInterval(procesarPendientes, cfg.CONTABILIDAD_INTERVALO_WORKER_SEG * 1000);
  timer.unref();
  console.log(
    `[contabilidad] Revisando envios pendientes cada ${cfg.CONTABILIDAD_INTERVALO_WORKER_SEG} s ` +
      `(maximo ${cfg.CONTABILIDAD_MAX_INTENTOS} intentos)`
  );
}

module.exports = { iniciar, procesarPendientes };