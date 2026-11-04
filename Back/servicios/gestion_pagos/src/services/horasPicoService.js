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

/**
 * TDSI-57/191/760: ventas por hora del dia (en hora de Bolivia) en un rango de fechas,
 * y opcionalmente de una sola caja ("si quiere, una caja" -- el rango de fechas en
 * cambio es obligatorio, segun el ticket).
 */
async function obtenerVentasPorHora(desde, hasta, cajaId) {
  const rango = validarRango(desde, hasta);
  const caja = cajaId != null && String(cajaId).trim() ? String(cajaId).trim() : null;
  return repo.ventasPorHoraEnRango(rango.desde, rango.hasta, caja);
}

/**
 * TDSI-57/762: las 3 horas con mas ventas, de mayor a menor cantidad (el monto desempata
 * un cantidad igual). "horas" ya viene solo con las horas que tuvieron ventas, asi que
 * si hubo menos de 3 horas con ventas, devuelve las que haya.
 */
function top3PorCantidad(horas) {
  return [...horas].sort((a, b) => b.cantidad - a.cantidad || b.monto - a.monto).slice(0, 3);
}

/**
 * TDSI-57/762: ventas por hora (TDSI-191/760/761) junto con las 3 horas pico, para el
 * grafico de barras y el resaltado ("Hora pico: 18:00 – 19:00") que arma el Front.
 */
async function obtenerHorasPico(desde, hasta, cajaId) {
  const horas = await obtenerVentasPorHora(desde, hasta, cajaId);
  return { horas, top3: top3PorCantidad(horas) };
}

module.exports = { obtenerVentasPorHora, obtenerHorasPico, top3PorCantidad, validarRango, limiteBolivia };
