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
    efectivoInicial: Number(turno.efectivo_inicial),
    ventasEfectivo: ef.ingresos,
    egresosEfectivo: ef.egresos,
    efectivoEsperado: aMonto(esperadoC),
    efectivoContado: aMonto(contadoC),
    diferencia: aMonto(diferenciaC),
    tipoDiferencia,
  };
}

/** TDSI-321: arma el reporte de cierre con totales por método (datos estructurados). */
async function generarReporteCierre(turnoId, efectivoContado = null) {
  const turno = await turnosRepo.obtenerTurnoPorId(turnoId);
  if (!turno) throw new AppError("Turno no encontrado", 404, { turnoId });

  const recaudado = await calcularTotalRecaudado(turnoId);
  const arqueo = efectivoContado != null ? await compararEfectivo(turnoId, efectivoContado) : null;

  return {
    turnoId,
    codigo: turno.codigo,
    cajaId: turno.caja_id,
    cajero: turno.cajero_nombre,
    abiertoEn: turno.abierto_en,
    totalesPorMetodo: recaudado.porMetodo,
    totalIngresos: recaudado.totalIngresos,
    totalEgresos: recaudado.totalEgresos,
    totalRecaudado: recaudado.totalRecaudado,
    operaciones: recaudado.operaciones,
    arqueoEfectivo: arqueo,
  };
}

/** TDSI-321: version en texto plano del reporte, lista para imprimir/mostrar. */
async function generarReporteTexto(turnoId, efectivoContado = null) {
  const r = await generarReporteCierre(turnoId, efectivoContado);
  const ANCHO = 44;
  const linea = (c = "-") => c.repeat(ANCHO);
  const col = (izq, der) => {
    const i = String(izq), d = String(der);
    const espacio = Math.max(1, ANCHO - i.length - d.length);
    return i + " ".repeat(espacio) + d;
  };

  const L = [];
  L.push(linea("="));
  L.push("      REPORTE DE CIERRE DE CAJA");
  L.push(linea("="));
  L.push(col("Turno:", r.codigo));
  L.push(col("Caja:", r.cajaId));
  L.push(col("Cajero:", r.cajero || "-"));
  L.push(col("Abierto:", new Date(r.abiertoEn).toLocaleString("es-BO")));
  L.push(linea());
  L.push("TOTALES POR METODO DE PAGO");
  for (const [metodo, v] of Object.entries(r.totalesPorMetodo)) {
    L.push(col(`  ${metodo} (${v.operaciones} op.)`, v.neto.toFixed(2)));
  }
  L.push(linea());
  L.push(col("TOTAL INGRESOS", r.totalIngresos.toFixed(2)));
  L.push(col("TOTAL EGRESOS", r.totalEgresos.toFixed(2)));
  L.push(col("TOTAL RECAUDADO", r.totalRecaudado.toFixed(2)));

  if (r.arqueoEfectivo) {
    L.push(linea());
    L.push("ARQUEO DE EFECTIVO");
    L.push(col("  Efectivo inicial", r.arqueoEfectivo.efectivoInicial.toFixed(2)));
    L.push(col("  Ventas efectivo", r.arqueoEfectivo.ventasEfectivo.toFixed(2)));
    L.push(col("  Egresos efectivo", r.arqueoEfectivo.egresosEfectivo.toFixed(2)));
    L.push(col("  Esperado", r.arqueoEfectivo.efectivoEsperado.toFixed(2)));
    L.push(col("  Contado", r.arqueoEfectivo.efectivoContado.toFixed(2)));
    L.push(col(`  ${r.arqueoEfectivo.tipoDiferencia}`, r.arqueoEfectivo.diferencia.toFixed(2)));
  }

  L.push(linea("="));
  return L.join("\n");
}

module.exports = { calcularTotalRecaudado, compararEfectivo, generarReporteCierre, generarReporteTexto };