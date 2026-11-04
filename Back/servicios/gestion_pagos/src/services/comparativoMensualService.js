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
 * TDSI-56/735: variación en % de "actual" contra "anterior". Si el mes anterior fue 0,
 * un porcentaje no tiene sentido (no se puede dividir entre 0): null si hubo venta este
 * mes (no hay con que comparar), 0 si tambien este mes esta en 0 (no cambio nada).
 */
function calcularVariacion(actual, anterior) {
  if (anterior === 0) return actual === 0 ? 0 : null;
  return Number((((actual - anterior) / anterior) * 100).toFixed(2));
}

/** Une el total actual/anterior de una clave (caja o metodo) con su variacion en %. */
function filaConVariacion(datos) {
  return { ...datos, variacion: calcularVariacion(datos.actual, datos.anterior) };
}

/** TDSI-56/735: por metodo, un objeto {actual,anterior} por cada metodo -> filas con variacion. */
function combinarPorMetodo(actual, anterior) {
  return Object.keys(actual).map((metodo) => filaConVariacion({ metodo, actual: actual[metodo], anterior: anterior[metodo] }));
}

/**
 * TDSI-56/735: por caja, una caja puede existir en un mes y no en el otro (p.ej. recien
 * abierta) -- se unen por caja_id y la que falta en alguno de los dos queda en 0.
 */
function combinarPorCaja(actualArr, anteriorArr) {
  const mapaActual = new Map(actualArr.map((c) => [c.caja_id, c.total]));
  const mapaAnterior = new Map(anteriorArr.map((c) => [c.caja_id, c.total]));
  const cajas = [...new Set([...mapaActual.keys(), ...mapaAnterior.keys()])].sort();
  return cajas.map((caja_id) => filaConVariacion({ caja_id, actual: mapaActual.get(caja_id) || 0, anterior: mapaAnterior.get(caja_id) || 0 }));
}

/**
 * TDSI-56/734/735: desglose por caja y por método de pago del mes elegido y del mes
 * anterior, con la variación en %. Todavía sin el ajuste de "mismos días" cuando el mes
 * elegido es el actual (TDSI-736).
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
    total: filaConVariacion({ actual: totalActual, anterior: totalAnterior }),
    porCaja: combinarPorCaja(cajaActual, cajaAnterior),
    porMetodo: combinarPorMetodo(metodoActual, metodoAnterior),
  };
}

module.exports = {
  obtenerTotalDelMes, obtenerDesgloseMensual, rangoDelMes, mesAnteriorDe, calcularVariacion, validarMesAnio, limiteBolivia,
};
