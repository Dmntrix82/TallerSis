const { AppError } = require("../utils/AppError");
const turnosRepo = require("../data/turnosRepo");
const movimientosRepo = require("../data/movimientosRepo");

const METODOS_VALIDOS = ["Efectivo", "Tarjeta", "QR", "Mixto"];

/** TDSI-322: bloquea el registro de nuevas ventas si el turno ya esta cerrado. */
async function registrarMovimiento(turnoId, { tipo, metodo, monto, origen_microservicio, referencia_externa, descripcion }) {
  const turno = await turnosRepo.obtenerTurnoPorId(turnoId);
  if (!turno) throw new AppError("Turno no encontrado", 404, { turnoId });

  if (turno.estado === "CERRADO") {
    throw new AppError("El turno esta cerrado: no se pueden registrar nuevas ventas en esta caja", 423, { turnoId });
  }
  if (!["INGRESO", "EGRESO"].includes(tipo)) {
    throw new AppError("El campo 'tipo' debe ser INGRESO o EGRESO", 400);
  }
  if (!METODOS_VALIDOS.includes(metodo)) {
    throw new AppError(`Metodo no valido. Use: ${METODOS_VALIDOS.join(", ")}`, 400);
  }
  if (typeof monto !== "number" || monto <= 0) {
    throw new AppError("El monto debe ser un numero mayor a 0", 400);
  }

  return movimientosRepo.insertar({
    caja_id: turno.caja_id,
    turno_id: turnoId,
    tipo,
    metodo,
    monto,
    origen_microservicio,
    referencia_externa,
    descripcion,
  });
}

module.exports = { registrarMovimiento };