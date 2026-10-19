const { AppError } = require("../utils/AppError");
const turnosRepo = require("../data/turnosRepo");
const cierreService = require("./cierreService");

/**
 * TDSI-483/484: lista turnos de una fecha con monto registrado (esperado) y monto disponible (contado).
 * - Turnos CERRADOS: usa efectivo_contado/efectivo_esperado ya guardados.
 * - Turnos ABIERTOS: calcula el esperado con compararEfectivo (sin cerrar nada).
 */
async function listarComparacion({ fecha, caja_id, cajero_id, tipo_diferencia }) {
  if (!fecha) throw new AppError("'fecha' es obligatoria", 400);

  const turnos = await turnosRepo.listarTurnosPorFecha({ fecha, caja_id, cajero_id });

  const resultados = [];
  for (const t of turnos) {
    let esperado, contado, diferencia, tipo;

    if (t.estado === "CERRADO" && t.efectivo_esperado != null) {
      esperado = Number(t.efectivo_esperado);
      contado = Number(t.efectivo_contado || 0);
      diferencia = Number(t.diferencia || 0);
      tipo = t.tipo_diferencia || "CUADRA";
    } else {
      // Turno abierto: calcular el esperado usando la lógica del cierre
      try {
        const c = await cierreService.compararEfectivo(t.id, Number(t.efectivo_contado || 0));
        esperado = c.efectivoEsperado;
        contado = c.efectivoContado;
        diferencia = c.diferencia;
        tipo = c.tipoDiferencia;
      } catch (e) {
        // Si falla (ej. gestion_pagos no responde), dejar 0
        esperado = 0;
        contado = 0;
        diferencia = 0;
        tipo = "CUADRA";
      }
    }

    resultados.push({
      turno_id: t.id,
      codigo: t.codigo,
      caja_id: t.caja_id,
      cajero_id: t.cajero_id,
      cajero_nombre: t.cajero_nombre,
      estado: t.estado,
      abierto_en: t.abierto_en,
      cerrado_en: t.cerrado_en,
      efectivo_esperado: esperado,
      efectivo_contado: contado,
      diferencia,
      tipo_diferencia: tipo,
    });
  }

  // TDSI-485: filtro por tipo_diferencia
  const filtrados = tipo_diferencia
    ? resultados.filter((r) => r.tipo_diferencia === tipo_diferencia)
    : resultados;

  // TDSI-486: resumen
  const resumen = {
    total: filtrados.length,
    cuadran: filtrados.filter((r) => r.tipo_diferencia === "CUADRA").length,
    faltantes: filtrados.filter((r) => r.tipo_diferencia === "FALTANTE").length,
    sobrantes: filtrados.filter((r) => r.tipo_diferencia === "SOBRANTE").length,
  };

  return { resumen, turnos: filtrados };
}

module.exports = { listarComparacion };
