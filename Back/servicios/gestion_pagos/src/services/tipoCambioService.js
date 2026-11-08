const { AppError } = require("../utils/AppError");
const repo = require("../data/tipoCambioRepo");

/** TDSI-161: devuelve el tipo de cambio vigente para el cobro en dólares. */
async function obtenerTipoCambio() {
  const vigente = await repo.obtenerVigente();
  if (!vigente) {
    throw new AppError("No hay un tipo de cambio configurado", 500);
  }
  return {
    valor: Number(vigente.valor),
    actualizado_en: vigente.actualizado_en,
    actualizado_por: vigente.actualizado_por,
  };
}

module.exports = { obtenerTipoCambio };