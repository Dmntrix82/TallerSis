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

// --------------------------------------------------------------------------
// TDSI-420: envio del reporte del lote (TDSI-419) a Contabilidad.
//   POST {CONTABILIDAD_URL}/reportes-cierre   (header Idempotency-Key)
//   2xx { "referencia": "..." }  -> recibido
// Devuelve { ok, status, referencia } o { ok: false, status, reintentable, error }.
// "reintentable" indica si vale la pena volver a intentar (caida, timeout, 5xx, 408, 429);
// un 4xx (por ejemplo 422) es un rechazo y reintentar no lo arregla.
// --------------------------------------------------------------------------

/** Receptor simulado para MODO_AISLADO: acepta el reporte, salvo CONTABILIDAD_SIMULAR_CAIDA=true. */
function envioSimulado(idempotencyKey, opciones = cfg) {
  if (opciones.CONTABILIDAD_SIMULAR_CAIDA) {
    return { ok: false, status: null, reintentable: true, error: "Contabilidad simulada fuera de servicio" };
  }
  return { ok: true, status: 201, referencia: `SIM-${idempotencyKey}`, simulado: true };
}

async function enviarReporte(reporte, idempotencyKey) {
  if (cfg.MODO_AISLADO) return envioSimulado(idempotencyKey);

  const headers = { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey };
  if (cfg.CONTABILIDAD_TOKEN) headers.Authorization = `Bearer ${cfg.CONTABILIDAD_TOKEN}`;

  try {
    const res = await fetch(`${cfg.CONTABILIDAD_URL}/reportes-cierre`, {
      method: "POST",
      headers,
      body: JSON.stringify(reporte),
      signal: AbortSignal.timeout(cfg.TIMEOUT_MS),
    });

    if (res.ok) {
      const cuerpo = await res.json().catch(() => null);
      const datos = cuerpo?.data && typeof cuerpo.data === "object" ? cuerpo.data : cuerpo;
      return { ok: true, status: res.status, referencia: datos?.referencia ?? datos?.id ?? null };
    }

    const texto = (await res.text().catch(() => "")).slice(0, 300);
    const reintentable = res.status >= 500 || res.status === 408 || res.status === 429;
    return { ok: false, status: res.status, reintentable, error: `HTTP ${res.status}: ${texto}` };
  } catch (e) {
    const error = e.name === "TimeoutError"
      ? `Contabilidad no respondio en ${cfg.TIMEOUT_MS} ms`
      : `Contabilidad no esta disponible: ${e.message}`;
    return { ok: false, status: null, reintentable: true, error };
  }
}

module.exports = { consultarPeriodoContable, periodoSimulado, enviarReporte, envioSimulado };