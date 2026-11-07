const { AppError } = require("../utils/AppError");
const { aCentavos, aMonto } = require("../utils/money");
const turnosRepo = require("../data/turnosRepo");
const diferenciasRepo = require("../data/diferenciasRepo");
const arqueoRepo = require("../data/arqueoRepo");
const { tipoDe } = require("../utils/denominaciones");
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

// TDSI-879: tope por denominacion, para frenar un numero escrito de mas (ej. 1000000).
const CANTIDAD_MAX = 100000;

/** TDSI-879: la cantidad de billetes o monedas tiene que ser un entero >= 0 (vacio cuenta como 0). */
function validarCantidad(valor, denominacion) {
  if (valor === undefined || valor === null || valor === "") return 0;
  const unidad = `${tipoDe(denominacion) === "BILLETE" ? "billetes" : "monedas"} de Bs ${denominacion.toFixed(2)}`;
  const texto = typeof valor === "string" ? valor.trim() : valor;
  const cantidad = typeof texto === "number" || (typeof texto === "string" && /^-?\d+(\.\d+)?$/.test(texto)) ? Number(texto) : NaN;
  if (!Number.isInteger(cantidad) || cantidad < 0) {
    throw new AppError(`Solo números enteros: la cantidad de ${unidad} debe ser un entero mayor o igual a 0.`, 400, { denominacion, cantidad: valor });
  }
  if (cantidad > CANTIDAD_MAX) {
    throw new AppError(`La cantidad de ${unidad} no puede pasar de ${CANTIDAD_MAX}.`, 400, { denominacion, cantidad: valor });
  }
  return cantidad;
}

/**
 * TDSI-877: arma el arqueo a partir de lo que conto el cajero.
 * detalle: [{ denominacion: 100, cantidad: 3 }, ...] -> filas con subtotal (solo las que
 * tienen cantidad) y el total contado. Se suma en centavos para no perder las monedas de
 * 0.10, 0.20 y 0.50 por redondeo.
 */
function calcularArqueo(detalle) {
  if (!Array.isArray(detalle) || detalle.length === 0) {
    throw new AppError("El arqueo debe ser una lista de { denominacion, cantidad }.", 400);
  }

  let totalC = 0;
  const filas = [];
  const vistas = new Set();
  for (const item of detalle) {
    if (!item || typeof item !== "object") {
      throw new AppError("Cada fila del arqueo debe ser { denominacion, cantidad }.", 400);
    }
    const denominacion = Number(item.denominacion);
    if (!tipoDe(denominacion)) {
      throw new AppError(`${item.denominacion} no es un billete ni una moneda de Bs.`, 400, { denominacion: item.denominacion });
    }
    if (vistas.has(denominacion)) {
      throw new AppError(`La denominacion de Bs ${denominacion.toFixed(2)} esta repetida en el arqueo.`, 400, { denominacion });
    }
    vistas.add(denominacion);
    const cantidad = validarCantidad(item.cantidad, denominacion);
    const subtotalC = aCentavos(denominacion) * cantidad;
    totalC += subtotalC;
    if (cantidad > 0) filas.push({ denominacion, cantidad, subtotal: aMonto(subtotalC) });
  }

  filas.sort((a, b) => b.denominacion - a.denominacion);
  return { filas, totalContado: aMonto(totalC) };
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

/**
 * TDSI-878: compara el total del arqueo por denominacion con el efectivo esperado del
 * turno, para mostrar cuadra / faltante / sobrante antes de confirmar el cierre.
 */
async function compararArqueo(turnoId, detalle) {
  const { filas, totalContado } = calcularArqueo(detalle);
  const comparacion = await compararEfectivo(turnoId, totalContado);
  return { ...comparacion, denominaciones: filas };
}

/**
 * TDSI-880: billetes y monedas contados en el turno, para el reporte de cierre.
 * null si el turno se cerro sin arqueo por denominacion.
 */
async function obtenerArqueoDenominaciones(turnoId) {
  const filas = await arqueoRepo.listarPorTurno(turnoId);
  if (filas.length === 0) return null;
  const totalC = filas.reduce((acc, f) => acc + aCentavos(f.subtotal), 0);
  return { detalle: filas.map((f) => ({ ...f, tipo: tipoDe(f.denominacion) })), totalContado: aMonto(totalC) };
}

/** TDSI-321: arma el reporte de cierre con totales por método (datos estructurados). */
async function generarReporteCierre(turnoId, efectivoContado = null) {
  const turno = await turnosRepo.obtenerTurnoPorId(turnoId);
  if (!turno) throw new AppError("Turno no encontrado", 404, { turnoId });

  const recaudado = await calcularTotalRecaudado(turnoId);
  // TDSI-880: un turno ya cerrado usa el efectivo contado que se guardo al cerrarlo,
  // asi el reporte (PDF o texto) muestra su arqueo aunque no se mande el monto.
  const contado = efectivoContado != null
    ? efectivoContado
    : turno.efectivo_contado != null ? Number(turno.efectivo_contado) : null;
  const arqueo = contado != null ? await compararEfectivo(turnoId, contado) : null;
  const arqueoDenominaciones = await obtenerArqueoDenominaciones(turnoId);

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
    arqueoDenominaciones,
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

  // TDSI-880: detalle de billetes y monedas contados
  if (r.arqueoDenominaciones) {
    L.push(linea());
    L.push("DETALLE DEL CONTEO");
    for (const d of r.arqueoDenominaciones.detalle) {
      const nombre = `${d.tipo === "BILLETE" ? "Billete" : "Moneda"} Bs ${d.denominacion.toFixed(2)}`;
      L.push(col(`  ${nombre} x ${d.cantidad}`, d.subtotal.toFixed(2)));
    }
    L.push(col("  TOTAL CONTADO", r.arqueoDenominaciones.totalContado.toFixed(2)));
  }

  L.push(linea("="));
  return L.join("\n");
}

/**
 * TDSI-322/325/326: cierra el turno y bloquea nuevas ventas en esa caja. Igual que
 * la apertura, el cajero no puede cerrar la caja solo: necesita que un supervisor
 * ponga su usuario + PIN (validado via supervisorProxy.js). Ya no pide el monto
 * contado en efectivo: el cierre se basa solo en lo que registro el sistema.
 * TDSI-877: tambien recibe el arqueo por denominacion ("arqueo"), lo guarda en
 * caja.arqueo_denominaciones y devuelve el total contado.
 */
async function cerrarTurno(turnoId, { supervisor_id, pin, efectivo_contado, arqueo: detalleArqueo } = {}) {
  const turno = await turnosRepo.obtenerTurnoPorId(turnoId);
  if (!turno) throw new AppError("Turno no encontrado", 404, { turnoId });
  if (turno.estado === "CERRADO") throw new AppError("El turno ya fue cerrado", 409, { turnoId });

  if (!supervisor_id || !pin) {
    throw new AppError("Se necesita el usuario y el PIN de un supervisor de caja para cerrar la caja.", 400);
  }

  // TDSI-487: el efectivo contado es opcional; si no viene, el cierre funciona como en TDSI-26.
  const hayContado = efectivo_contado !== undefined && efectivo_contado !== null && efectivo_contado !== "";
  if (hayContado && !Number.isFinite(Number(efectivo_contado))) {
    throw new AppError("El efectivo contado debe ser un numero mayor o igual a 0", 400);
  }

  const conteo = detalleArqueo !== undefined && detalleArqueo !== null ? calcularArqueo(detalleArqueo) : null;
  // TDSI-878: con arqueo, el efectivo contado ES su total; si tambien mandan
  // efectivo_contado, tiene que coincidir para no guardar dos montos distintos.
  if (conteo && hayContado && aCentavos(efectivo_contado) !== aCentavos(conteo.totalContado)) {
    throw new AppError(
      `El efectivo contado (${Number(efectivo_contado).toFixed(2)}) no coincide con el total del arqueo (${conteo.totalContado.toFixed(2)}).`,
      400,
      { efectivo_contado: Number(efectivo_contado), total_arqueo: conteo.totalContado }
    );
  }
  const contado = conteo ? conteo.totalContado : hayContado ? Number(efectivo_contado) : null;

  const supervisor = await validarSupervisor({ supervisor_id, pin });

  // Si viene el arqueo o efectivo_contado, calculamos la diferencia contra lo esperado.
  // Va antes de guardar el arqueo: si gestion_pagos no responde, el cierre falla sin
  // dejar billetes y monedas guardados en un turno que sigue abierto.
  const arqueo = contado !== null ? await compararEfectivo(turnoId, contado) : null;

  // Se guarda justo antes de marcar el turno cerrado: si eso falla, un reintento lo reemplaza.
  const denominaciones = conteo ? await arqueoRepo.reemplazarArqueo(turnoId, conteo.filas) : [];

  const turnoCerrado = await turnosRepo.marcarCerrado(turnoId, {
    efectivoContado: arqueo ? arqueo.efectivoContado : null,
    efectivoEsperado: arqueo ? arqueo.efectivoEsperado : null,
    diferencia: arqueo ? arqueo.diferencia : null,
    tipoDiferencia: arqueo ? arqueo.tipoDiferencia : null,
    cerradoPor: supervisor.supervisor_id,
    cerradoPorNombre: supervisor.nombre,
  });

  const reporte = await generarReporteCierre(turnoId, arqueo ? arqueo.efectivoContado : null);

  // TDSI-487: Registrar la diferencia si el supervisor envió el efectivo contado
  if (arqueo && arqueo.tipoDiferencia !== "CUADRA") {
    await diferenciasRepo.insertar({
      turno_id: turnoId,
      monto: arqueo.diferencia,
      tipo: arqueo.tipoDiferencia,
    });
  }

  return {
    turno: turnoCerrado,
    reporte,
    arqueoDenominaciones: conteo ? { detalle: denominaciones, totalContado: conteo.totalContado } : null,
  };
}

module.exports = { calcularTotalRecaudado, calcularArqueo, compararEfectivo, compararArqueo, generarReporteCierre, generarReporteTexto, cerrarTurno };