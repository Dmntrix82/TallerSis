// TDSI-415: configuracion de los servicios externos que alimentan el Lote de Cierre Diario.
// MODO_AISLADO=true permite trabajar sin levantar los demas microservicios:
// los proxies devuelven datos simulados en vez de hacer la llamada HTTP.
function entero(nombre, defecto, min, max) {
  const v = Number(process.env[nombre] ?? defecto);
  if (!Number.isInteger(v) || v < min || v > max)
    throw new Error(`${nombre} debe ser un entero entre ${min} y ${max}`);
  return v;
}

// TDSI-636: lista "YYYY-MM,YYYY-MM" de periodos que el receptor simulado responde como CERRADOS.
function listaPeriodos(nombre) {
  const valores = String(process.env[nombre] || "").split(",").map((p) => p.trim()).filter(Boolean);
  for (const p of valores) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(p)) throw new Error(`${nombre}: "${p}" no tiene formato YYYY-MM`);
  }
  return valores;
}

const bool = (nombre) => String(process.env[nombre] || "false").toLowerCase() === "true";

module.exports = {
  MODO_AISLADO: bool("MODO_AISLADO"),
  GESTION_PAGOS_URL: (process.env.GESTION_PAGOS_URL || "http://localhost:4005").replace(/\/+$/, ""),
  TIMEOUT_MS: entero("INTEGRACIONES_TIMEOUT_MS", 5000, 500, 30000),

  // TDSI-636: modulo de Contabilidad (periodos contables)
  CONTABILIDAD_URL: (process.env.CONTABILIDAD_URL || "http://localhost:4998").replace(/\/+$/, ""),
  CONTABILIDAD_TOKEN: process.env.CONTABILIDAD_TOKEN || null,
  CONTABILIDAD_SIMULADO_CERRADOS: listaPeriodos("CONTABILIDAD_SIMULADO_CERRADOS"),
  CONTABILIDAD_SIMULAR_CAIDA: bool("CONTABILIDAD_SIMULAR_CAIDA"),

  // TDSI-422: reintentos del envio del reporte a Contabilidad
  CONTABILIDAD_MAX_INTENTOS: entero("CONTABILIDAD_MAX_INTENTOS", 3, 1, 10),
  CONTABILIDAD_BACKOFF_BASE_SEG: entero("CONTABILIDAD_BACKOFF_BASE_SEG", 30, 1, 3600),
  CONTABILIDAD_INTERVALO_WORKER_SEG: entero("CONTABILIDAD_INTERVALO_WORKER_SEG", 15, 5, 3600),

  // TDSI-122: al generar un lote, enviar su reporte a Contabilidad sin que nadie lo pida
  CONTABILIDAD_ENVIO_AUTOMATICO: String(process.env.CONTABILIDAD_ENVIO_AUTOMATICO ?? "true").toLowerCase() === "true",
};