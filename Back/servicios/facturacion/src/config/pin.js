const MAX_INTENTOS = Number(process.env.PIN_MAX_INTENTOS ?? 3);
const BLOQUEO_MIN = Number(process.env.PIN_BLOQUEO_MIN ?? 15);

if (!Number.isInteger(MAX_INTENTOS) || MAX_INTENTOS < 1 || MAX_INTENTOS > 10)
  throw new Error("PIN_MAX_INTENTOS debe ser un entero entre 1 y 10");
if (!Number.isInteger(BLOQUEO_MIN) || BLOQUEO_MIN < 1 || BLOQUEO_MIN > 1440)
  throw new Error("PIN_BLOQUEO_MIN debe ser un entero entre 1 y 1440 minutos");

const PIN_REGEX = /^\d{4,6}$/;

module.exports = { MAX_INTENTOS, BLOQUEO_MIN, PIN_REGEX };