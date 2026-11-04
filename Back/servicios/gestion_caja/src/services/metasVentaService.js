const { AppError } = require("../utils/AppError");
const metasRepo = require("../data/metasVentaRepo");
const cajasRepo = require("../data/cajasRepo");

/** Forma publica de una meta (monto en Bs, quien la cambio y cuando). */
function aPublico(meta) {
  return {
    caja_id: meta.caja_id,
    monto_meta: meta.monto_meta,
    actualizado_por: meta.actualizado_por,
    actualizado_en: meta.actualizado_en,
  };
}

/**
 * TDSI-58/773: "Editar meta" -- fija (o cambia) la meta de ventas diaria de una caja.
 * Exige que la meta sea mayor a 0 y que la caja exista.
 */
async function actualizarMeta(cajaId, { monto, actualizado_por } = {}) {
  if (!cajaId || !String(cajaId).trim()) {
    throw new AppError("Falta el id de la caja.", 400);
  }
  const montoMeta = Number(monto);
  if (!Number.isFinite(montoMeta) || montoMeta <= 0) {
    throw new AppError("La meta debe ser un monto mayor a 0.", 400, { monto });
  }

  const caja = await cajasRepo.buscarPorCodigo(cajaId);
  if (!caja) throw new AppError(`La caja "${cajaId}" no existe`, 404, { caja_id: cajaId });

  const meta = await metasRepo.guardarMeta(cajaId, { montoMeta, actualizadoPor: actualizado_por });
  return aPublico(meta);
}

module.exports = { actualizarMeta, aPublico };
