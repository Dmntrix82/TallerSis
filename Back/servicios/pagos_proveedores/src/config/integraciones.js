// TDSI-415: configuracion de los servicios externos que alimentan el Lote de Cierre Diario.
// MODO_AISLADO=true permite trabajar sin levantar los demas microservicios:
// los proxies devuelven datos simulados en vez de hacer la llamada HTTP.
function entero(nombre, defecto, min, max) {
  const v = Number(process.env[nombre] ?? defecto);
  if (!Number.isInteger(v) || v < min || v > max)
    throw new Error(`${nombre} debe ser un entero entre ${min} y ${max}`);
  return v;
}

module.exports = {
  MODO_AISLADO: String(process.env.MODO_AISLADO || "false").toLowerCase() === "true",
  GESTION_PAGOS_URL: (process.env.GESTION_PAGOS_URL || "http://localhost:4005").replace(/\/+$/, ""),
  TIMEOUT_MS: entero("INTEGRACIONES_TIMEOUT_MS", 5000, 500, 30000),
};