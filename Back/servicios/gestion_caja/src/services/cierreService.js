const { AppError } = require("../utils/AppError");
const { aCentavos, aMonto } = require("../utils/money");
const turnosRepo = require("../data/turnosRepo");
const movimientosRepo = require("../data/movimientosRepo");

/** TDSI-319: calcula el total recaudado durante el turno, desglosado por método. */
async function calcularTotalRecaudado(turnoId) {
  const turno = await turnosRepo.obtenerTurnoPorId(turnoId);
  if (!turno) throw new AppError("Turno no encontrado", 404, { turnoId });

  const movimientos = await movimientosRepo.listarPorTurno(turnoId);

  const porMetodo = {};
  let ingresosC = 0;
  let egresosC = 0;

  for (const m of movimientos) {
    const c = aCentavos(m.monto);
    if (!porMetodo[m.metodo]) {
      porMetodo[m.metodo] = { ingresos: 0, egresos: 0, neto: 0, operaciones: 0 };
    }
    porMetodo[m.metodo].operaciones += 1;
    if (m.tipo === "INGRESO") {
      porMetodo[m.metodo].ingresos += c;
      ingresosC += c;
    } else {
      porMetodo[m.metodo].egresos += c;
      egresosC += c;
    }
  }

  for (const metodo of Object.keys(porMetodo)) {
    const v = porMetodo[metodo];
    v.neto = aMonto(v.ingresos - v.egresos);
    v.ingresos = aMonto(v.ingresos);
    v.egresos = aMonto(v.egresos);
  }

  return {
    turnoId,
    caja_id: turno.caja_id,
    totalIngresos: aMonto(ingresosC),
    totalEgresos: aMonto(egresosC),
    totalRecaudado: aMonto(ingresosC - egresosC),
    operaciones: movimientos.length,
    porMetodo,
  };
}

/** TDSI-320: compara efectivo inicial + ventas en efectivo - egresos en efectivo, contra lo contado. */
async function compararEfectivo(turnoId, efectivoContado) {
  if (efectivoContado === undefined || efectivoContado === null) {
    throw new AppError("Debe enviar 'efectivoContado'", 400);
  }
  if (typeof efectivoContado !== "number" || efectivoContado < 0) {
    throw new AppError("El efectivo contado debe ser un numero mayor o igual a 0", 400);
  }

  const turno = await turnosRepo.obtenerTurnoPorId(turnoId);
  if (!turno) throw new AppError("Turno no encontrado", 404, { turnoId });

  const recaudado = await calcularTotalRecaudado(turnoId);
  const ef = recaudado.porMetodo.Efectivo || { ingresos: 0, egresos: 0 };

  const inicialC = aCentavos(turno.efectivo_inicial);
  const esperadoC = inicialC + aCentavos(ef.ingresos) - aCentavos(ef.egresos);
  const contadoC = aCentavos(efectivoContado);
  const diferenciaC = contadoC - esperadoC;

  const tipoDiferencia = diferenciaC === 0 ? "CUADRA" : diferenciaC > 0 ? "SOBRANTE" : "FALTANTE";

  return {
    turnoId,
    efectivoInicial: turno.efectivo_inicial,
    ventasEfectivo: ef.ingresos,
    egresosEfectivo: ef.egresos,
    efectivoEsperado: aMonto(esperadoC),
    efectivoContado: aMonto(contadoC),
    diferencia: aMonto(diferenciaC),
    tipoDiferencia,
  };
}

module.exports = { calcularTotalRecaudado, compararEfectivo };