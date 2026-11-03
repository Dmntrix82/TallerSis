// TDSI-51/179/684: integracion Pub/Sub con el Marketplace -- suscripcion (Pull) a
// "marketplace-ventas" (ellos -> nosotros) y topico de salida "pagos-facturas-emitidas"
// (nosotros -> ellos). Sin las variables correspondientes no se lee ni se publica nada
// (desarrollo local sin credenciales).
function entero(nombre, defecto, min, max) {
  const v = Number(process.env[nombre] ?? defecto);
  if (!Number.isInteger(v) || v < min || v > max)
    throw new Error(`${nombre} debe ser un entero entre ${min} y ${max}`);
  return v;
}

function topico(nombre) {
  const v = String(process.env[nombre] || "").trim();
  if (v && !/^(projects\/[a-z][a-z0-9-]{4,28}[a-z0-9]\/topics\/)?[A-Za-z][\w.~+%-]{2,254}$/.test(v))
    throw new Error(`${nombre} debe tener la forma projects/<proyecto>/topics/<topico>`);
  return v || null;
}

// La llave de la cuenta de servicio pegada en el .env (JSON en una linea o base64).
// Si no esta, la libreria usa GOOGLE_APPLICATION_CREDENTIALS (ruta al archivo).
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

module.exports = {
  GOOGLE_CREDENTIALS: credencialesGoogle("GOOGLE_CREDENTIALS_JSON"),
  PUBSUB_TIMEOUT_MS: entero("PUBSUB_TIMEOUT_MS", 10000, 1000, 60000),

  // Suscripcion Pull del topico "marketplace-ventas". Vacio = no se leen mensajes.
  VENTAS_SUBSCRIPTION: String(process.env.MARKETPLACE_VENTAS_SUBSCRIPTION || "").trim() || null,
  VENTAS_INTERVALO_SEG: entero("MARKETPLACE_VENTAS_INTERVALO_SEG", 15, 5, 3600),

  // TDSI-51/684: topico de salida "pagos-facturas-emitidas". Vacio = no se publica nada.
  FACTURAS_TOPIC: topico("MARKETPLACE_FACTURAS_TOPIC"),
};
