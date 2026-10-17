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

/**
 * TDSI-431: historial de operaciones de los cajeros para el Supervisor de Caja.
 * Filtros: fecha o desde/hasta (por defecto los ultimos 7 dias), cajero_id (opcional).
 * Paginacion: pagina (desde 1) y por_pagina (por defecto 20, maximo 100).
 */
async function consultarHistorial({ cajero_id, fecha, desde, hasta, pagina, por_pagina } = {}) {
  const rango = validarRangoHistorial({ fecha, desde, hasta });
  const cajeroId = validarCajeroOpcional(cajero_id);
  const paginaN = validarEnteroPositivo(pagina, "pagina", 1);
  const porPaginaN = validarEnteroPositivo(por_pagina, "por_pagina", POR_PAGINA_DEFECTO, POR_PAGINA_MAXIMO);

  const { total, filas } = await repo.listarHistorial({
    ...rango,
    cajeroId,
    limite: porPaginaN,
    offset: (paginaN - 1) * porPaginaN,
  });

  return {
    filtros: { ...rango, cajero_id: cajeroId },
    paginacion: {
      pagina: paginaN,
      por_pagina: porPaginaN,
      total_registros: total,
      total_paginas: Math.ceil(total / porPaginaN),
    },
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