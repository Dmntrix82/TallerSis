const crypto = require("crypto");
const QRCode = require("qrcode");
const repo = require("../data/pagosRepo");

// Para que el QR sirva de verdad al escanearlo desde un celular, la URL debe
// ser publica (no "localhost"). En este proyecto academico se deja localhost
// como default y se puede pisar con PUBLIC_API_URL cuando este desplegado.
const BASE_URL_VERIFICACION = process.env.PUBLIC_API_URL || `http://localhost:${process.env.PORT || 4005}`;

/**
 * TDSI-38/153: token unico e impredecible para el QR de verificacion de una
 * factura. A diferencia del "codigo de verificacion" cosmetico que ya se
 * imprime en el PDF (un hash de id_transaccion+fecha, calculado al vuelo),
 * este token se genera al azar y se guarda en la base -- es lo que permite
 * despues buscar la factura por el QR (TDSI-528).
 */
function generarTokenVerificacion() {
  return crypto.randomBytes(24).toString("hex"); // 48 caracteres
}

/** TDSI-527: URL que el QR codifica -- apunta al endpoint publico de TDSI-528. */
function urlVerificacion(token) {
  return `${BASE_URL_VERIFICACION}/api/facturas/verificar/${token}`;
}

/**
 * TDSI-527: si la venta ya tiene un token, lo reusa (para que el QR no
 * cambie entre una impresion y una reimpresion); si no tiene, genera uno
 * nuevo y lo guarda antes de devolverlo.
 */
async function obtenerOCrearToken(id_transaccion) {
  const existente = await repo.obtenerTokenVerificacion(id_transaccion);
  if (existente) return existente;

  const token = generarTokenVerificacion();
  await repo.guardarTokenVerificacion(id_transaccion, token);
  // Si dos pedidos llegaron al mismo tiempo, el primero gano (la columna es
  // UNIQUE); se relee para devolver siempre el token que quedo guardado de verdad.
  return repo.obtenerTokenVerificacion(id_transaccion);
}

/** TDSI-527: imagen del QR (Buffer PNG) que, al escanearse, lleva a la URL de verificacion. */
async function generarImagenQrVerificacion(token, { ancho = 160 } = {}) {
  const dataUrl = await QRCode.toDataURL(urlVerificacion(token), { margin: 0, width: ancho });
  return Buffer.from(dataUrl.split(",")[1], "base64");
}

module.exports = {
  generarTokenVerificacion,
  urlVerificacion,
  obtenerOCrearToken,
  generarImagenQrVerificacion,
};
