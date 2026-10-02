function entero(nombre, defecto, min, max) {
  const v = Number(process.env[nombre] ?? defecto);
  if (!Number.isInteger(v) || v < min || v > max)
    throw new Error(`${nombre} debe ser un entero entre ${min} y ${max}`);
  return v;
}

if (!process.env.COMPRAS_API_URL) throw new Error("COMPRAS_API_URL no está definido en .env");

module.exports = {
  COMPRAS_API_URL: process.env.COMPRAS_API_URL.replace(/\/+$/, ""),
  COMPRAS_API_TOKEN: process.env.COMPRAS_API_TOKEN || null,
  TIMEOUT_MS: entero("COMPRAS_TIMEOUT_MS", 5000, 500, 30000),
  MAX_INTENTOS: entero("COMPRAS_MAX_INTENTOS", 5, 1, 20),
  BACKOFF_BASE_SEG: entero("COMPRAS_BACKOFF_BASE_SEG", 30, 1, 3600),
  INTERVALO_WORKER_SEG: entero("COMPRAS_INTERVALO_WORKER_SEG", 15, 5, 3600),
};