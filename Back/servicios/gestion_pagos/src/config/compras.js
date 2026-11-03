// TDSI-54/682: reporte de productos vendidos del dia, publicado para Compras y
// Proveedores por Google Pub/Sub. Mismo patron que CONTABILIDAD_PUBSUB_TOPIC en
// facturacion -- no es la misma integracion que COMPRAS_API_URL de pagos_proveedores
// (esa es HTTP, para confirmaciones de pago a proveedores; esto es Pub/Sub, para avisar
// que se vendio). Sin topico configurado no se publica nada (desarrollo local sin credenciales).
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
  PUBSUB_TOPIC: topico("COMPRAS_PUBSUB_TOPIC"),
  GOOGLE_CREDENTIALS: credencialesGoogle("GOOGLE_CREDENTIALS_JSON"),
  PUBSUB_TIMEOUT_MS: entero("PUBSUB_TIMEOUT_MS", 10000, 1000, 60000),
};
