const { AppError } = require("./AppError");

const ZONA_HORARIA = "America/La_Paz";
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Fecha de hoy (YYYY-MM-DD) en la zona horaria del negocio, no la del servidor. */
function hoyLocal() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_HORARIA }).format(new Date());
}

/** TDSI-415: valida que la fecha sea un dia real "YYYY-MM-DD" y que no este en el futuro. */
function validarFechaCierre(valor) {
  if (typeof valor !== "string" || !FECHA_REGEX.test(valor)) {
    throw new AppError("La 'fecha' debe tener formato YYYY-MM-DD", 400, { fecha: valor ?? null });
  }
  const d = new Date(`${valor}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== valor) {
    throw new AppError("La 'fecha' no es un dia valido", 400, { fecha: valor });
  }
  if (valor > hoyLocal()) {
    throw new AppError("No se puede consolidar una fecha futura", 400, { fecha: valor, hoy: hoyLocal() });
  }
  return valor;
}

module.exports = { ZONA_HORARIA, hoyLocal, validarFechaCierre };