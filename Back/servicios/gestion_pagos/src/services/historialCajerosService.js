const repo = require("../data/historialCajerosRepo");
const { validarCajeroId, validarRango, validarEnteroPositivo } = require("./revisionService");
const { validarFechaDia } = require("../utils/fechaLocal");

const DIAS_POR_DEFECTO = 7;
const POR_PAGINA_DEFECTO = 20;
const POR_PAGINA_MAXIMO = 100;

const restarDias = (dia, n) => new Date(Date.parse(`${dia}T00:00:00Z`) - n * 86400000).toISOString().slice(0, 10);

/**
 * Rango del historial (inclusive): "fecha" para un solo dia o "desde"/"hasta" (maximo 92 dias).
 * Sin fechas son los ultimos 7 dias hasta hoy; con solo "hasta", los 7 dias que terminan ese dia.
 */
function validarRangoHistorial({ fecha, desde, hasta }) {
  if (!fecha && !desde) {
    const h = validarFechaDia(hasta, "hasta");
    return validarRango({ desde: restarDias(h, DIAS_POR_DEFECTO - 1), hasta: h });
  }
  return validarRango({ fecha, desde, hasta });
}

/** cajero_id es opcional en el historial: sin el, salen todos los cajeros. */
const validarCajeroOpcional = (valor) => (valor === undefined || valor === null || valor === "" ? null : validarCajeroId(valor));

const totalesCajero = (r) => ({
  cajero_id: r.cajero_id,
  cajero: r.cajero,
  cantidad_operaciones: r.cantidad_operaciones,
  cantidad_anuladas: r.cantidad_anuladas,
  total: r.total,
  total_anulado: r.total_anulado,
});

/**
 * TDSI-432: resumen de todo el historial filtrado (no solo de la pagina que se muestra):
 *   - general: cantidad de operaciones, cuantas anuladas, total cobrado (APROBADAS) y total anulado
 *   - por_cajero: lo mismo por cajero, con cuantos dias trabajo y su primera y ultima operacion
 *   - por_dia: lo mismo por dia (del mas reciente al mas antiguo) y, dentro, el detalle por cajero
 */
function armarResumen({ general, porDia, porCajero, porCajeroDia }) {
  return {
    cantidad_operaciones: general.cantidad_operaciones,
    cantidad_anuladas: general.cantidad_anuladas,
    total: general.total,
    total_anulado: general.total_anulado,
    por_cajero: porCajero.map((c) => ({
      ...totalesCajero(c),
      dias_con_operaciones: c.dias_con_operaciones,
      primera_operacion: c.primera_operacion,
      ultima_operacion: c.ultima_operacion,
    })),
    por_dia: porDia.map((d) => ({
      fecha: d.fecha_local,
      cantidad_operaciones: d.cantidad_operaciones,
      cantidad_anuladas: d.cantidad_anuladas,
      total: d.total,
      total_anulado: d.total_anulado,
      cajeros: porCajeroDia.filter((cd) => cd.fecha_local === d.fecha_local).map(totalesCajero),
    })),
  };
}

/**
 * TDSI-431: historial de operaciones de los cajeros para el Supervisor de Caja.
 * Filtros: fecha o desde/hasta (por defecto los ultimos 7 dias), cajero_id (opcional).
 * Paginacion: pagina (desde 1) y por_pagina (por defecto 20, maximo 100).
 * TDSI-432: ademas trae el resumen por cajero y por dia de todo lo filtrado.
 */
async function consultarHistorial({ cajero_id, fecha, desde, hasta, pagina, por_pagina } = {}) {
  const rango = validarRangoHistorial({ fecha, desde, hasta });
  const cajeroId = validarCajeroOpcional(cajero_id);
  const paginaN = validarEnteroPositivo(pagina, "pagina", 1);
  const porPaginaN = validarEnteroPositivo(por_pagina, "por_pagina", POR_PAGINA_DEFECTO, POR_PAGINA_MAXIMO);

  const filtros = { ...rango, cajeroId };
  const [{ total, filas }, resumen] = await Promise.all([
    repo.listarHistorial({ ...filtros, limite: porPaginaN, offset: (paginaN - 1) * porPaginaN }),
    repo.resumenHistorial(filtros),
  ]);

  return {
    filtros: { ...rango, cajero_id: cajeroId },
    paginacion: {
      pagina: paginaN,
      por_pagina: porPaginaN,
      total_registros: total,
      total_paginas: Math.ceil(total / porPaginaN),
    },
    resumen: armarResumen(resumen),
    operaciones: filas.map((f) => ({
      id_transaccion: f.id_transaccion,
      fecha: f.fecha,
      fecha_local: f.fecha_local,
      hora: f.hora,
      cajero_id: f.cajero_id,
      cajero: f.cajero,
      caja_id: f.caja_id,
      tipo_pago: f.tipo_pago,
      metodos: f.metodos,
      detalle_metodos: f.detalle_metodos,
      total: f.total,
      estado: f.estado,
      revision: {
        estado: f.revision_estado,
        nota: f.revision_nota,
        revisado_por: f.revision_revisado_por,
        revisado_en: f.revision_revisado_en,
      },
    })),
  };
}

module.exports = { DIAS_POR_DEFECTO, validarRangoHistorial, consultarHistorial };