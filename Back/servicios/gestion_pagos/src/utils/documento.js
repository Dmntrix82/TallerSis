const TIPOS_DOCUMENTO_VALIDOS = ["NIT", "CI"];

// En Bolivia el NIT tiene exactamente 10 digitos; el CI tiene 7 u 8.
const REGEX_POR_TIPO = {
  NIT: /^\d{10}$/,
  CI: /^\d{7,8}$/,
};

const MENSAJE_FORMATO = {
  NIT: "El NIT debe tener exactamente 10 dígitos.",
  CI: "El CI debe tener entre 7 y 8 dígitos.",
};

/** Devuelve un mensaje de error si el numero no cumple el formato boliviano de ese tipo, o null si es valido. */
function validarFormatoDocumento(tipoDocumento, numero) {
  const regex = REGEX_POR_TIPO[tipoDocumento];
  if (!regex) return "El tipo de documento debe ser NIT o CI.";
  return regex.test(String(numero || "").trim()) ? null : MENSAJE_FORMATO[tipoDocumento];
}

module.exports = { TIPOS_DOCUMENTO_VALIDOS, validarFormatoDocumento };
