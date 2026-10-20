const { AppError } = require("./AppError");

// El "dia" del negocio es el de Bolivia (America/La_Paz, UTC-4 todo el año, sin horario
// de verano), no el del servidor: en Docker/Supabase el servidor corre en UTC.
const ZONA = "America/La_Paz";
const OFFSET_BOLIVIA = "-04:00";
const UN_DIA_MS = 24 * 60 * 60 * 1000;

/** Fecha de hoy (YYYY-MM-DD) en hora de Bolivia. */
function hoyLocal() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(new Date());
}

/** Valida una fecha "YYYY-MM-DD" (dia real del calendario). */
function validarDia(valor, campo) {
  const d = new Date(`${valor}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(valor)) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== valor) {
    throw new AppError(`'${campo}' debe ser una fecha valida con formato YYYY-MM-DD`, 400, { [campo]: valor });
  }
  return valor;
}

/** Inicio (00:00) y fin (23:59:59.999) de un rango de dias de Bolivia, como instantes. */
function limitesDelRango(desde, hasta) {
  const inicio = new Date(`${desde}T00:00:00${OFFSET_BOLIVIA}`);
  const fin = new Date(new Date(`${hasta}T00:00:00${OFFSET_BOLIVIA}`).getTime() + UN_DIA_MS - 1);
  return { inicio, fin };
}

module.exports = { ZONA, hoyLocal, validarDia, limitesDelRango };
