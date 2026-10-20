const { AppError } = require("./AppError");

// La Paz no tiene horario de verano: el "dia" del negocio siempre es UTC-4.
const ZONA_HORARIA = "America/La_Paz";

/** Fecha de hoy (YYYY-MM-DD) en hora de Bolivia, no la del servidor. */
function hoyLocal() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_HORARIA }).format(new Date());
}

/** Valida una fecha "YYYY-MM-DD" (dia real). Si no viene, devuelve la de hoy. */
function validarFechaDia(valor, campo = "fecha") {
  if (valor === undefined || valor === null || valor === "") return hoyLocal();
  const d = new Date(`${valor}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(valor)) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== valor) {
    throw new AppError(`El campo '${campo}' debe ser una fecha valida con formato YYYY-MM-DD.`, 400, { [campo]: valor });
  }
  return valor;
}

module.exports = { ZONA_HORARIA, hoyLocal, validarFechaDia };