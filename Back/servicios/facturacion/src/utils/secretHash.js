const crypto = require("crypto");

const KEYLEN = 64;

function hashSecret(secret) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(secret, salt, KEYLEN).toString("hex");
  return `${salt}:${hash}`;
}

function verificarSecret(secret, almacenado) {
  const [salt, hash] = String(almacenado).split(":");
  if (!salt || !hash) return false;
  const calculado = crypto.scryptSync(secret, salt, KEYLEN);
  const esperado = Buffer.from(hash, "hex");
  return (
    esperado.length === calculado.length &&
    crypto.timingSafeEqual(esperado, calculado)
  );
}

module.exports = { hashSecret, verificarSecret };