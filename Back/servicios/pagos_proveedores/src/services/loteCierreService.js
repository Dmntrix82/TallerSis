const { AppError } = require("../utils/AppError");
const lotesCierreRepo = require("../data/lotesCierreRepo");
const { calcularTotalesDelDia } = require("./totalesCierreService");
const { consultarPeriodoContable } = require("../clients/contabilidadProxy");
const { validarFechaCierre } = require("../utils/fecha");

function validarGeneradoPor(valor) {
  const texto = typeof valor === "string" ? valor.trim() : "";
  if (!texto) throw new AppError("El campo 'generado_por' es obligatorio.", 400);
  if (texto.length > 60) throw new AppError("El campo 'generado_por' admite hasta 60 caracteres.", 400);
  return texto;
}

function errorLoteExistente(lote) {
  return new AppError(`Ya existe un lote de cierre para la fecha ${lote.fecha}.`, 409, { codigo: "LOTE_EXISTENTE", lote });
}

/**
 * TDSI-637: solo se genera el lote si Contabilidad confirma que el periodo de la fecha esta ABIERTO.
 *   - Contabilidad no responde / responde algo invalido -> 503 CONTABILIDAD_NO_DISPONIBLE
 *   - Periodo cerrado                                    -> 422 PERIODO_CERRADO
 * Ante la duda se bloquea: nunca se genera un lote sin la confirmacion de Contabilidad.
 */
async function verificarPeriodoAbierto(fecha) {
  const periodo = await consultarPeriodoContable(fecha);
  if (!periodo.disponible) {
    throw new AppError(
      "Contabilidad no disponible: no se pudo verificar el periodo contable. Intente mas tarde.",
      503,
      { codigo: "CONTABILIDAD_NO_DISPONIBLE", periodo: periodo.periodo, motivo: periodo.motivo }
    );
  }
  if (!periodo.abierto) {
    throw new AppError(
      `Periodo contable cerrado: el periodo ${periodo.periodo} ya fue cerrado en Contabilidad y no admite nuevos lotes.`,
      422,
      { codigo: "PERIODO_CERRADO", periodo: periodo.periodo }
    );
  }
  return periodo;
}

/**
 * TDSI-120/417/637: genera y guarda el Lote de Cierre Diario de una fecha.
 * Si la fecha ya tiene lote responde 409 con el lote existente (para que el front lo muestre).
 */
async function generarLote({ fecha, generado_por } = {}) {
  const fechaValida = validarFechaCierre(fecha);
  const generadoPor = validarGeneradoPor(generado_por);

  // Se revisa antes de calcular para no consultar a gestion_pagos en vano.
  const existente = await lotesCierreRepo.obtenerPorFecha(fechaValida);
  if (existente) throw errorLoteExistente(existente);

  const periodoContable = await verificarPeriodoAbierto(fechaValida);
  const totales = await calcularTotalesDelDia(fechaValida);

  const lote = await lotesCierreRepo.guardarLote({
    ...totales,
    detalle: { ...totales.detalle, periodoContable },
    generadoPor,
  });
  if (!lote) {
    // Otra solicitud genero el lote de esta fecha mientras se calculaban los totales.
    throw errorLoteExistente(await lotesCierreRepo.obtenerPorFecha(fechaValida));
  }
  return lote;
}

/** TDSI-418: consulta el lote ya generado de una fecha; 404 si esa fecha aun no tiene lote. */
async function consultarLote(fecha) {
  const fechaValida = validarFechaCierre(fecha);
  const lote = await lotesCierreRepo.obtenerPorFecha(fechaValida);
  if (!lote) throw new AppError(`No existe un lote de cierre para la fecha ${fechaValida}.`, 404, { fecha: fechaValida });
  return lote;
}

module.exports = { generarLote, consultarLote };