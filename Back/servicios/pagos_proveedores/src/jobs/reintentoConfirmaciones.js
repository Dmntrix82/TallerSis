const repo = require("../data/confirmacionesRepo");
const { intentarEnvio } = require("../services/confirmacionPagoService");
const cfg = require("../config/compras");

let enCurso = false;

async function procesarPendientes() {
  if (enCurso) return;
  enCurso = true;
  try {
    const pendientes = await repo.tomarPendientes(10);
    for (const conf of pendientes) {
      const r = await intentarEnvio(conf);
      if (r.enviada) {
        console.log(`[reintentos] Confirmación ${conf.id} enviada: orden ${conf.orden_pago_id}`);
      } else {
        console.warn(`[reintentos] Confirmación ${conf.id} falló (intento ${r.intentos}, ${r.estado}): ${r.error}`);
      }
    }
  } catch (e) {
    console.error("[reintentos] Error procesando pendientes:", e.message);
  } finally {
    enCurso = false;
  }
}

function iniciar() {
  const timer = setInterval(procesarPendientes, cfg.INTERVALO_WORKER_SEG * 1000);
  timer.unref();
  console.log(`[reintentos] Revisando confirmaciones pendientes cada ${cfg.INTERVALO_WORKER_SEG} s`);
}

module.exports = { iniciar, procesarPendientes };