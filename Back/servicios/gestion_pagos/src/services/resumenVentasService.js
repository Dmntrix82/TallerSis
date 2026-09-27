const { AppError } = require("../utils/AppError");
const repo = require("../data/resumenVentasRepo");

/** TDSI-101/327/328/329: resumen de ventas del turno actual del cajero, por metodo de pago */
async function obtenerResumenPorTurno(turnoId) {
  if (!turnoId) {
    throw new AppError("El turnoId es obligatorio.", 400);
  }

  const porMetodo = await repo.resumenPorMetodo(turnoId);
  const totalGeneral = porMetodo.reduce((acc, m) => acc + m.total, 0);

  return { turnoId, porMetodo, totalGeneral };
}

module.exports = { obtenerResumenPorTurno };
