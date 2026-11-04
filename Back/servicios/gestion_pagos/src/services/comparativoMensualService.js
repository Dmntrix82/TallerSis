const { AppError } = require("../utils/AppError");
const repo = require("../data/comparativoMensualRepo");

// Bolivia no tiene horario de verano: el offset es -04:00 todo el año. Se arma el
// limite con el offset explicito (no new Date("YYYY-MM-DDT00:00:00"), que depende de
// en que huso horario corra el servidor) para que el corte del mes sea exacto.
function limiteBolivia(anio, mes, dia) {
  const mm = String(mes).padStart(2, "0");
  const dd = String(dia).padStart(2, "0");
  return new Date(`${anio}-${mm}-${dd}T00:00:00-04:00`);
}

/** TDSI-56/189: [desde, hasta) de un mes calendario completo, en hora de Bolivia. */
function rangoDelMes(anio, mes) {
  const desde = limiteBolivia(anio, mes, 1);
  const hastaMes = mes === 12 ? 1 : mes + 1;
  const hastaAnio = mes === 12 ? anio + 1 : anio;
  const hasta = limiteBolivia(hastaAnio, hastaMes, 1);
  return { desde, hasta };
}

function validarMesAnio(mes, anio) {
  const m = Number(mes);
  const a = Number(anio);
  if (!Number.isInteger(m) || m < 1 || m > 12) {
    throw new AppError("El 'mes' debe ser un número entre 1 y 12.", 400, { mes });
  }
  if (!Number.isInteger(a) || a < 2000 || a > 2100) {
    throw new AppError("El 'año' no es válido.", 400, { anio });
  }
  return { mes: m, anio: a };
}

/** TDSI-56/189: total vendido del mes pedido (caja física + online), sin anuladas. */
async function obtenerTotalDelMes(mes, anio) {
  const { mes: m, anio: a } = validarMesAnio(mes, anio);
  const { desde, hasta } = rangoDelMes(a, m);
  const total = await repo.totalVendidoEnRango(desde, hasta);
  return { mes: m, anio: a, total };
}

/** El mes calendario anterior al (mes, anio) dado, con el cambio de año en enero. */
function mesAnteriorDe(mes, anio) {
  return mes === 1 ? { mes: 12, anio: anio - 1 } : { mes: mes - 1, anio };
}

/**
 * TDSI-56/734: desglose por caja y por método de pago del mes elegido y del mes
 * anterior, uno al lado del otro. Todavía sin la variación en % (TDSI-735) ni el
 * ajuste de "mismos días" cuando el mes elegido es el actual (TDSI-736).
 */
async function obtenerDesgloseMensual(mes, anio) {
  const { mes: m, anio: a } = validarMesAnio(mes, anio);
  const anterior = mesAnteriorDe(m, a);

  const rangoActual = rangoDelMes(a, m);
  const rangoAnterior = rangoDelMes(anterior.anio, anterior.mes);

  const [totalActual, totalAnterior, cajaActual, cajaAnterior, metodoActual, metodoAnterior] = await Promise.all([
    repo.totalVendidoEnRango(rangoActual.desde, rangoActual.hasta),
    repo.totalVendidoEnRango(rangoAnterior.desde, rangoAnterior.hasta),
    repo.totalesPorCajaEnRango(rangoActual.desde, rangoActual.hasta),
    repo.totalesPorCajaEnRango(rangoAnterior.desde, rangoAnterior.hasta),
    repo.totalesPorMetodoEnRango(rangoActual.desde, rangoActual.hasta),
    repo.totalesPorMetodoEnRango(rangoAnterior.desde, rangoAnterior.hasta),
  ]);

  return {
    mes: m,
    anio: a,
    mesAnterior: anterior.mes,
    anioAnterior: anterior.anio,
    total: { actual: totalActual, anterior: totalAnterior },
    porCaja: { actual: cajaActual, anterior: cajaAnterior },
    porMetodo: { actual: metodoActual, anterior: metodoAnterior },
  };
}

module.exports = { obtenerTotalDelMes, obtenerDesgloseMensual, rangoDelMes, mesAnteriorDe, validarMesAnio, limiteBolivia };
