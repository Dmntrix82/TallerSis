const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Devuelve un mensaje de error si el correo no tiene un formato valido, o null si es valido. */
function validarEmail(email) {
  return EMAIL_REGEX.test(String(email || "").trim()) ? null : "Ingrese un correo válido.";
}

module.exports = { EMAIL_REGEX, validarEmail };
