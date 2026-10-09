const cfg = require("../config/integraciones");

// TDSI-636: pregunta al modulo de Contabilidad si el periodo contable (mes) de una
// fecha esta abierto. Contrato esperado:
//   GET {CONTABILIDAD_URL}/periodos-contables/estado?fecha=YYYY-MM-DD
//   200 { "periodo": "YYYY-MM", "estado": "ABIERTO" | "CERRADO" }   (tambien acepta { "abierto": true|false })
// Nunca lanza error: devuelve { disponible: false, motivo } si Contabilidad no responde
// o responde algo que no se entiende, y la decision de bloquear la toma TDSI-637.

const periodoDe = (fecha) => fecha.slice(0, 7);

/** Receptor simulado para MODO_AISLADO: abierto salvo los periodos de CONTABILIDAD_SIMULADO_CERRADOS. */
function periodoSimulado(fecha, opciones = cfg) {
  const periodo = periodoDe(fecha);
  if (opciones.CONTABILIDAD_SIMULAR_CAIDA) {
    return { disponible: false, periodo, origen: "SIMULADO", motivo: "Contabilidad simulada fuera de servicio" };
  }
  const abierto = !opciones.CONTABILIDAD_SIMULADO_CERRADOS.includes(periodo);
  return { disponible: true, periodo, abierto, estado: abierto ? "ABIERTO" : "CERRADO", origen: "SIMULADO" };
}

/** Interpreta la respuesta de Contabilidad; null si no trae un estado reconocible. */
function leerEstado(cuerpo) {
  if (!cuerpo || typeof cuerpo !== "object") return null;
  const datos = cuerpo.data && typeof cuerpo.data === "object" ? cuerpo.data : cuerpo;
  if (typeof datos.abierto === "boolean") return datos.abierto;
  const estado = String(datos.estado || "").toUpperCase();
  if (estado === "ABIERTO") return true;
  if (estado === "CERRADO") return false;
  return null;
}

async function consultarPeriodoContable(fecha) {
  if (cfg.MODO_AISLADO) return periodoSimulado(fecha);

  const periodo = periodoDe(fecha);
  const headers = { Accept: "application/json" };
  if (cfg.CONTABILIDAD_TOKEN) headers.Authorization = `Bearer ${cfg.CONTABILIDAD_TOKEN}`;

  let respuesta;
  try {
    respuesta = await fetch(
      `${cfg.CONTABILIDAD_URL}/periodos-contables/estado?${new URLSearchParams({ fecha })}`,
      { headers, signal: AbortSignal.timeout(cfg.TIMEOUT_MS) }
    );
  } catch (e) {
    const motivo = e.name === "TimeoutError"
      ? `Contabilidad no respondio en ${cfg.TIMEOUT_MS} ms`
      : "Contabilidad no esta disponible";
    return { disponible: false, periodo, origen: "CONTABILIDAD", motivo };
  }

  if (!respuesta.ok) {
    return { disponible: false, periodo, origen: "CONTABILIDAD", motivo: `Contabilidad respondio HTTP ${respuesta.status}` };
  }

  const cuerpo = await respuesta.json().catch(() => null);
  const abierto = leerEstado(cuerpo);
  if (abierto === null) {
    return { disponible: false, periodo, origen: "CONTABILIDAD", motivo: "Respuesta de Contabilidad no reconocida" };
  }

  const datos = cuerpo.data && typeof cuerpo.data === "object" ? cuerpo.data : cuerpo;
  return {
    disponible: true,
    periodo: datos.periodo || periodo,
    abierto,
    estado: abierto ? "ABIERTO" : "CERRADO",
    origen: "CONTABILIDAD",
  };
}

module.exports = { consultarPeriodoContable, periodoSimulado };