const { AppError } = require("../utils/AppError");
const ordenesPagoRepo = require("../data/ordenesPagoRepo");

/** TDSI-400: valida que la orden de pago exista y este pendiente antes de vincular el egreso */
async function validarOrdenPagable(orden_pago_id) {
  const orden = await ordenesPagoRepo.buscarPorId(orden_pago_id);

  if (!orden) {
    throw new AppError(`La orden de pago "${orden_pago_id}" no existe.`, 404);
  }
  if (orden.estado !== "PENDIENTE") {
    throw new AppError(`La orden de pago "${orden.numero}" ya fue liquidada.`, 409);
  }

  return orden;
}

async function liquidarOrden(orden_pago_id, liquidada_por) {
  return ordenesPagoRepo.marcarLiquidada(orden_pago_id, liquidada_por);
}

module.exports = { validarOrdenPagable, liquidarOrden };
