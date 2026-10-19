const crypto = require("crypto");

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

module.exports = { generarTokenVerificacion };
