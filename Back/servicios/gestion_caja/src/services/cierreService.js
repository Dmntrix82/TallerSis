const { AppError } = require("../utils/AppError");
const { aCentavos, aMonto } = require("../utils/money");
const turnosRepo = require("../data/turnosRepo");
const { obtenerReporteVentas } = require("./pagosProxy");
const { validarSupervisor } = require("./supervisorProxy");

/**
 * TDSI-319/323: calcula el total recaudado durante el turno, desglosado por método.
 * Consulta a gestion_pagos (pagos.transacciones), que es la fuente real de las ventas;
 * caja.movimientos nunca se llego a alimentar desde ningun microservicio, por eso ya
 * no se usa aca. "hasta" es el cierre del turno si ya esta cerrado, o el momento actual
 * si todavia esta abierto (para poder previsualizar el reporte antes de cerrar).
 */
async function calcularTotalRecaudado(turnoId) {
  const turno = await turnosRepo.obtenerTurnoPorId(turnoId);
  if (!turno) throw new AppError("Turno no encontrado", 404, { turnoId });

  const hasta = turno.cerrado_en || new Date();
  const reporteVentas = await obtenerReporteVentas({ caja_id: turno.caja_id, desde: turno.abierto_en, hasta });

  const porMetodo = {
    Efectivo: { ingresos: reporteVentas.totalEfectivo, egresos: 0, neto: reporteVentas.totalEfectivo, operaciones: reporteVentas.operacionesPorMetodo.Efectivo },
    Tarjeta: { ingresos: reporteVentas.totalTarjeta, egresos: 0, neto: reporteVentas.totalTarjeta, operaciones: reporteVentas.operacionesPorMetodo.Tarjeta },
    QR: { ingresos: reporteVentas.totalQR, egresos: 0, neto: reporteVentas.totalQR, operaciones: reporteVentas.operacionesPorMetodo.QR },
  };

  return {
    turnoId,
    caja_id: turno.caja_id,
    totalIngresos: reporteVentas.totalGeneral,
    totalEgresos: 0,
    totalRecaudado: reporteVentas.totalGeneral,
    operaciones: reporteVentas.cantidadVentas,
    porMetodo,
    resumenVentas: {
      totalDigital: reporteVentas.totalDigital,
      cantidadVentas: reporteVentas.cantidadVentas,
      cantidadAnuladas: reporteVentas.cantidadAnuladas,
      montoAnulado: reporteVentas.montoAnulado,
    },
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
    cajero: turno.cajero_nombre || turno.cajero_id,
    abiertoEn: turno.abierto_en,
    cerradoEn: turno.cerrado_en,
    cerradoPorNombre: turno.cerrado_por_nombre || turno.cerrado_por,
    totalesPorMetodo: recaudado.porMetodo,
    totalIngresos: recaudado.totalIngresos,
    totalEgresos: recaudado.totalEgresos,
    totalRecaudado: recaudado.totalRecaudado,
    operaciones: recaudado.operaciones,
    resumenVentas: recaudado.resumenVentas,
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

  if (r.resumenVentas) {
    L.push(linea());
    L.push(col("Total en digital (Tarjeta+QR)", r.resumenVentas.totalDigital.toFixed(2)));
    L.push(col("Cantidad de ventas", r.resumenVentas.cantidadVentas));
    L.push(col("Facturas anuladas", r.resumenVentas.cantidadAnuladas));
    if (r.resumenVentas.cantidadAnuladas > 0) {
      L.push(col("  Monto anulado", r.resumenVentas.montoAnulado.toFixed(2)));
    }
  }

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

/**
 * TDSI-322/325/326: cierra el turno y bloquea nuevas ventas en esa caja. Igual que
 * la apertura, el cajero no puede cerrar la caja solo: necesita que un supervisor
 * ponga su usuario + PIN (validado via supervisorProxy.js). Ya no pide el monto
 * contado en efectivo: el cierre se basa solo en lo que registro el sistema.
 */
async function cerrarTurno(turnoId, { supervisor_id, pin } = {}) {
  const turno = await turnosRepo.obtenerTurnoPorId(turnoId);
  if (!turno) throw new AppError("Turno no encontrado", 404, { turnoId });
  if (turno.estado === "CERRADO") throw new AppError("El turno ya fue cerrado", 409, { turnoId });

  if (!supervisor_id || !pin) {
    throw new AppError("Se necesita el usuario y el PIN de un supervisor de caja para cerrar la caja.", 400);
  }

  const supervisor = await validarSupervisor({ supervisor_id, pin });

  const turnoCerrado = await turnosRepo.marcarCerrado(turnoId, {
    efectivoContado: null,
    efectivoEsperado: null,
    diferencia: null,
    tipoDiferencia: null,
    cerradoPor: supervisor.supervisor_id,
    cerradoPorNombre: supervisor.nombre,
  });

  const reporte = await generarReporteCierre(turnoId);

  return { turno: turnoCerrado, reporte };
}

module.exports = { calcularTotalRecaudado, compararEfectivo, generarReporteCierre, generarReporteTexto, cerrarTurno };