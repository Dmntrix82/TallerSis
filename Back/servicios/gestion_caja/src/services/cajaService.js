const { AppError } = require("../utils/AppError");
const cajasRepo = require("../data/cajasRepo");

/** TDSI-266: valida que la caja/terminal exista y este activa antes de habilitarla */
async function validarCajaDisponible(caja_id) {
  if (!caja_id) {
    throw new AppError("El campo caja_id es obligatorio.", 400);
  }

  const caja = await cajasRepo.buscarPorCodigo(caja_id);

  if (!caja) {
    throw new AppError(`La caja "${caja_id}" no existe.`, 404);
  }
  if (caja.estado !== "ACTIVA") {
    throw new AppError(`La caja "${caja_id}" esta inactiva, no se puede habilitar el terminal.`, 403);
  }

  return caja;
}

module.exports = { validarCajaDisponible };
