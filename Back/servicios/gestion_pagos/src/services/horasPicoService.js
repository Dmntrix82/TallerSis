const { AppError } = require("../utils/AppError");
const repo = require("../data/horasPicoRepo");

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Bolivia no tiene horario de verano: el offset es -04:00 todo el año (mismo criterio
// que comparativoMensualService.js, para que el corte de hora/dia sea exacto sin
// depender del huso horario del servidor).
function limiteBolivia(fecha) {
  return new Date(`${fecha}T00:00:00-04:00`);
}

/** TDSI-57/191: valida el rango de fechas ("YYYY-MM-DD") y lo convierte a [desde, hasta). */
function validarRango(desde, hasta) {
  if (!FECHA_REGEX.test(String(desde))) {
    throw new AppError("'desde' debe tener formato YYYY-MM-DD.", 400, { desde });
  }
  if (!FECHA_REGEX.test(String(hasta))) {
    throw new AppError("'hasta' debe tener formato YYYY-MM-DD.", 400, { hasta });
  }
  const desdeFecha = limiteBolivia(desde);
  const hastaFecha = new Date(limiteBolivia(hasta).getTime() + 24 * 60 * 60 * 1000); // dia completo, hasta exclusivo
  if (Number.isNaN(desdeFecha.getTime()) || Number.isNaN(hastaFecha.getTime())) {
    throw new AppError("La fecha no es válida.", 400, { desde, hasta });
  }
  if (desdeFecha > hastaFecha) {
    throw new AppError("'desde' no puede ser posterior a 'hasta'.", 400, { desde, hasta });
  }
  return { desde: desdeFecha, hasta: hastaFecha };
}

/** TDSI-57/191: ventas por hora del dia (en hora de Bolivia) en un rango de fechas. */
async function obtenerVentasPorHora(desde, hasta) {
  const rango = validarRango(desde, hasta);
  return repo.ventasPorHoraEnRango(rango.desde, rango.hasta);
}

module.exports = { obtenerVentasPorHora, validarRango, limiteBolivia };
