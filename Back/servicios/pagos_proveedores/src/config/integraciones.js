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

// TDSI-656: topico de Pub/Sub, "projects/<proyecto>/topics/<topico>" o solo "<topico>".
function topico(nombre) {
  const v = String(process.env[nombre] || "").trim();
  if (v && !/^(projects\/[a-z][a-z0-9-]{4,28}[a-z0-9]\/topics\/)?[A-Za-z][\w.~+%-]{2,254}$/.test(v))
    throw new Error(`${nombre} debe tener la forma projects/<proyecto>/topics/<topico>`);
  return v || null;
}

// TDSI-656: la llave de la cuenta de servicio pegada en el .env, en una sola linea
// (JSON entre comillas simples) o en base64. Alternativa a GOOGLE_APPLICATION_CREDENTIALS.
function credencialesGoogle(nombre) {
  const v = String(process.env[nombre] || "").trim();
  if (!v) return null;
  const texto = v.startsWith("{") ? v : Buffer.from(v, "base64").toString("utf8");
  let cred;
  try {
    cred = JSON.parse(texto);
  } catch {
    // Con comillas dobles dotenv convierte los \n de private_key en saltos reales: se devuelven a \n.
    try { cred = JSON.parse(texto.replace(/\r?\n/g, "\\n")); } catch { cred = null; }
  }
  if (!cred) {
    throw new Error(`${nombre} no es un JSON valido (pegalo en una sola linea entre comillas simples, o en base64)`);
  }
  if (!cred.client_email || !cred.private_key || !cred.project_id)
    throw new Error(`${nombre} debe tener project_id, client_email y private_key`);
  return { project_id: cred.project_id, client_email: cred.client_email, private_key: cred.private_key };
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

  // TDSI-656: con PUBSUB_TOPIC el reporte se publica en Google Pub/Sub en vez de ir por HTTP.
  // Credenciales: GOOGLE_CREDENTIALS_JSON (llave en el .env) o, si no esta,
  // GOOGLE_APPLICATION_CREDENTIALS (ruta a la llave, la lee la libreria de Google).
  PUBSUB_TOPIC: topico("PUBSUB_TOPIC"),
  GOOGLE_CREDENTIALS: credencialesGoogle("GOOGLE_CREDENTIALS_JSON"),
  PUBSUB_TIMEOUT_MS: entero("PUBSUB_TIMEOUT_MS", 10000, 1000, 60000),
};