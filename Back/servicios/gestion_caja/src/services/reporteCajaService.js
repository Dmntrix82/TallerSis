const { AppError } = require("../utils/AppError");
const { aCentavos, aMonto } = require("../utils/money");
const cajasRepo = require("../data/cajasRepo");
const turnosRepo = require("../data/turnosRepo");
const diferenciasRepo = require("../data/diferenciasRepo");
const { generarReporteCierre } = require("./cierreService");
const { hoyLocal, validarDia, limitesDelRango } = require("../utils/fechas");

const METODOS = ["Efectivo", "Tarjeta", "QR"];
const RANGO_MAXIMO_DIAS = 92;
const num = (v) => (v === null || v === undefined ? null : Number(v));

function validarFiltros({ caja_id, desde, hasta }) {
  const caja = typeof caja_id === "string" ? caja_id.trim() : "";
  if (!caja) throw new AppError("El campo 'caja_id' es obligatorio", 400);
  const d = desde ? validarDia(desde, "desde") : hasta ? validarDia(hasta, "hasta") : hoyLocal();
  const h = hasta ? validarDia(hasta, "hasta") : d;
  if (d > h) throw new AppError("'desde' no puede ser mayor que 'hasta'", 400, { desde, hasta });
  const dias = (Date.parse(`${h}T00:00:00Z`) - Date.parse(`${d}T00:00:00Z`)) / 86400000 + 1;
  if (dias > RANGO_MAXIMO_DIAS) throw new AppError(`El rango no puede superar ${RANGO_MAXIMO_DIAS} dias`, 400, { desde: d, hasta: h });
  return { caja_id: caja, desde: d, hasta: h };
}

/**
 * TDSI-491/492: reporte de operaciones de una caja en un rango de dias (hora de Bolivia).
 * Reutiliza generarReporteCierre (TDSI-321) por cada turno abierto en el rango y suma:
 * totales por metodo, ventas, anulaciones, arqueo de cada turno y diferencias registradas.
 */
async function generarReporte(filtros = {}) {
  const { caja_id, desde, hasta } = validarFiltros(filtros);
  const caja = await cajasRepo.buscarPorCodigo(caja_id);
  if (!caja) throw new AppError(`La caja "${caja_id}" no existe`, 404, { caja_id });

  const turnosRango = await turnosRepo.listarTurnosPorCajaYRango({ caja_id, ...limitesDelRango(desde, hasta) });

  const totales = Object.fromEntries(METODOS.map((m) => [m, { ingresos: 0, operaciones: 0 }]));
  const acum = { ingresos: 0, ventas: 0, anuladas: 0, montoAnulado: 0 };
  const turnos = [];

  for (const t of turnosRango) {
    const r = await generarReporteCierre(t.id);
    for (const m of METODOS) {
      const v = r.totalesPorMetodo[m] || { ingresos: 0, operaciones: 0 };
      totales[m].ingresos += aCentavos(v.ingresos);
      totales[m].operaciones += v.operaciones;
    }
    acum.ingresos += aCentavos(r.totalIngresos);
    acum.ventas += r.resumenVentas.cantidadVentas;
    acum.anuladas += r.resumenVentas.cantidadAnuladas;
    acum.montoAnulado += aCentavos(r.resumenVentas.montoAnulado);

    turnos.push({
      turno_id: t.id,
      codigo: t.codigo,
      cajero: t.cajero_nombre || t.cajero_id,
      estado: t.estado,
      abierto_en: t.abierto_en,
      cerrado_en: t.cerrado_en,
      total_recaudado: r.totalRecaudado,
      ventas: r.resumenVentas.cantidadVentas,
      anuladas: r.resumenVentas.cantidadAnuladas,
      monto_anulado: r.resumenVentas.montoAnulado,
      por_metodo: Object.fromEntries(METODOS.map((m) => [m, r.totalesPorMetodo[m] ? r.totalesPorMetodo[m].ingresos : 0])),
      efectivo_inicial: num(t.efectivo_inicial),
      efectivo_esperado: num(t.efectivo_esperado),
      efectivo_contado: num(t.efectivo_contado),
      diferencia: num(t.diferencia),
      tipo_diferencia: t.tipo_diferencia || null,
    });
  }

  const diferencias = await diferenciasRepo.listarPorTurnos(turnos.map((t) => t.turno_id));
  const codigoTurno = Object.fromEntries(turnos.map((t) => [t.turno_id, t.codigo]));
  const sumar = (lista) => aMonto(lista.reduce((a, d) => a + aCentavos(d.monto), 0));

  return {
    caja_id,
    caja_nombre: caja.nombre,
    desde,
    hasta,
    resumen: {
      turnos: turnos.length,
      total_recaudado: aMonto(acum.ingresos),
      ventas: acum.ventas,
      anuladas: acum.anuladas,
      monto_anulado: aMonto(acum.montoAnulado),
      diferencias: diferencias.length,
      diferencias_pendientes: diferencias.filter((d) => d.estado === "PENDIENTE").length,
      total_faltantes: sumar(diferencias.filter((d) => d.tipo === "FALTANTE")),
      total_sobrantes: sumar(diferencias.filter((d) => d.tipo === "SOBRANTE")),
    },
    totales_por_metodo: METODOS.map((m) => ({ metodo: m, monto: aMonto(totales[m].ingresos), operaciones: totales[m].operaciones })),
    turnos,
    diferencias: diferencias.map((d) => ({ ...d, turno_codigo: codigoTurno[d.turno_id] })),
  };
}

// ---------- TDSI-493: CSV ----------

const celda = (v) => {
  if (v === null || v === undefined) return "";
  const s = v instanceof Date ? v.toISOString() : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const fila = (valores) => valores.map(celda).join(",");
const monto = (v) => (v === null || v === undefined ? "" : Number(v).toFixed(2));
const fechaBolivia = (f) =>
  f ? new Intl.DateTimeFormat("sv-SE", { timeZone: "America/La_Paz", dateStyle: "short", timeStyle: "medium" }).format(new Date(f)) : "";

/** TDSI-493: version descargable del reporte (CSV con BOM para que Excel respete los acentos). */
function reporteACsv(r) {
  const L = [];
  L.push(fila(["Reporte de operaciones de caja"]));
  L.push(fila(["Caja", r.caja_id, r.caja_nombre]));
  L.push(fila(["Desde", r.desde, "Hasta", r.hasta]));
  L.push("");
  L.push(fila(["RESUMEN"]));
  L.push(fila(["Turnos", "Total recaudado", "Ventas", "Anuladas", "Monto anulado", "Diferencias", "Pendientes", "Total faltantes", "Total sobrantes"]));
  const s = r.resumen;
  L.push(fila([s.turnos, monto(s.total_recaudado), s.ventas, s.anuladas, monto(s.monto_anulado), s.diferencias, s.diferencias_pendientes, monto(s.total_faltantes), monto(s.total_sobrantes)]));
  L.push("");
  L.push(fila(["TOTALES POR METODO"]));
  L.push(fila(["Metodo", "Monto", "Operaciones"]));
  for (const m of r.totales_por_metodo) L.push(fila([m.metodo, monto(m.monto), m.operaciones]));
  L.push("");
  L.push(fila(["TURNOS"]));
  L.push(fila(["Codigo", "Cajero", "Estado", "Apertura", "Cierre", "Efectivo", "Tarjeta", "QR", "Total", "Ventas", "Anuladas", "Inicial", "Esperado", "Contado", "Diferencia", "Tipo"]));
  for (const t of r.turnos) {
    L.push(fila([t.codigo, t.cajero, t.estado, fechaBolivia(t.abierto_en), fechaBolivia(t.cerrado_en),
      monto(t.por_metodo.Efectivo), monto(t.por_metodo.Tarjeta), monto(t.por_metodo.QR), monto(t.total_recaudado),
      t.ventas, t.anuladas, monto(t.efectivo_inicial), monto(t.efectivo_esperado), monto(t.efectivo_contado), monto(t.diferencia), t.tipo_diferencia]));
  }
  L.push("");
  L.push(fila(["DIFERENCIAS"]));
  L.push(fila(["Turno", "Tipo", "Monto", "Estado", "Justificacion", "Resuelta por", "Resuelta en"]));
  for (const d of r.diferencias) {
    L.push(fila([d.turno_codigo, d.tipo, monto(d.monto), d.estado, d.justificacion, d.resuelta_por, fechaBolivia(d.resuelta_en)]));
  }
  return "﻿" + L.join("\r\n") + "\r\n";
}

module.exports = { generarReporte, reporteACsv };
