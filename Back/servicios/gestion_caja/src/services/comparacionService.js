const { AppError } = require("../utils/AppError");
const turnosRepo = require("../data/turnosRepo");
const cierreService = require("./cierreService");
const { hoyLocal, validarDia } = require("../utils/fechas");

const TIPOS = ["CUADRA", "FALTANTE", "SOBRANTE", "SIN_ARQUEO"];

/** TDSI-485: filtro opcional por tipo de diferencia (acepta minusculas). */
function validarTipo(valor) {
  if (valor === undefined || valor === null || valor === "") return null;
  const tipo = String(valor).trim().toUpperCase();
  if (!TIPOS.includes(tipo)) {
    throw new AppError(`El 'tipo' debe ser uno de: ${TIPOS.join(", ")}`, 400, { tipo: valor });
  }
  return tipo;
}

/**
 * Monto registrado (esperado) y monto disponible (contado) de un turno:
 *  1. Turno CERRADO con arqueo guardado (el cajero declaro el efectivo contado en
 *     persona, al cerrar, junto con el PIN del supervisor) -> se usan esos montos.
 *  2. Si nadie conto el efectivo todavia (turno abierto, o cerrado sin arqueo) ->
 *     se informa el esperado, sin contado ni diferencia (SIN_ARQUEO). Nunca se
 *     asume contado = 0: eso inventaria un faltante.
 * Si gestion_pagos no responde, el error se propaga (no se muestra un CUADRA falso).
 */
async function compararTurno(t) {
  if (t.efectivo_esperado != null && t.efectivo_contado != null) {
    return {
      efectivo_esperado: Number(t.efectivo_esperado),
      efectivo_contado: Number(t.efectivo_contado),
      diferencia: Number(t.diferencia),
      tipo_diferencia: t.tipo_diferencia,
      fuente_contado: "CIERRE",
    };
  }

  const c = await cierreService.compararEfectivo(t.id, 0); // solo para obtener el esperado
  return {
    efectivo_esperado: c.efectivoEsperado,
    efectivo_contado: null,
    diferencia: null,
    tipo_diferencia: "SIN_ARQUEO",
    fuente_contado: null,
  };
}

/**
 * TDSI-483/484/485/486: turnos de una fecha (hora de Bolivia; por defecto hoy) con su monto
 * registrado (esperado) y su monto disponible (contado), filtros por caja, cajero y tipo de
 * diferencia, y el resumen (cuantos cuadran, faltantes, sobrantes y sin arqueo).
 */
async function listarComparacion({ fecha, caja_id, cajero_id, tipo_diferencia } = {}) {
  const dia = fecha ? validarDia(fecha, "fecha") : hoyLocal();
  const tipo = validarTipo(tipo_diferencia);

  const turnos = await turnosRepo.listarTurnosPorFecha({ fecha: dia, caja_id, cajero_id });

  const resultados = [];
  for (const t of turnos) {
    resultados.push({
      turno_id: t.id,
      codigo: t.codigo,
      caja_id: t.caja_id,
      cajero_id: t.cajero_id,
      cajero_nombre: t.cajero_nombre,
      estado: t.estado,
      abierto_en: t.abierto_en,
      cerrado_en: t.cerrado_en,
      ...(await compararTurno(t)),
    });
  }

  const filtrados = tipo ? resultados.filter((r) => r.tipo_diferencia === tipo) : resultados;
  const contar = (tp) => filtrados.filter((r) => r.tipo_diferencia === tp).length;

  return {
    filtros: { fecha: dia, caja_id: caja_id || null, cajero_id: cajero_id || null, tipo: tipo },
    resumen: {
      total: filtrados.length,
      cuadran: contar("CUADRA"),
      faltantes: contar("FALTANTE"),
      sobrantes: contar("SOBRANTE"),
      sin_arqueo: contar("SIN_ARQUEO"),
    },
    turnos: filtrados,
  };
}

module.exports = { listarComparacion };
