const { AppError } = require("../utils/AppError");
const egresosRepo = require("../data/egresosRepo");

const METODOS_VALIDOS = ["TRANSFERENCIA", "CHEQUE", "EFECTIVO"];

/** TDSI-399: registra el egreso de dinero por el pago a un proveedor */
async function registrarEgreso({ orden_pago_id, monto, metodo, descripcion, registrado_por }) {
  if (!orden_pago_id) {
    throw new AppError("El campo orden_pago_id es obligatorio.", 400);
  }
  if (monto === undefined || typeof monto !== "number" || monto <= 0) {
    throw new AppError("El campo monto debe ser un numero mayor a 0.", 400);
  }
  const metodoFinal = metodo || "TRANSFERENCIA";
  if (!METODOS_VALIDOS.includes(metodoFinal)) {
    throw new AppError(`El metodo "${metodoFinal}" no esta permitido. Use: ${METODOS_VALIDOS.join(", ")}.`, 400);
  }

  return egresosRepo.insertarEgreso({ orden_pago_id, monto, metodo: metodoFinal, descripcion, registrado_por });
}

module.exports = { registrarEgreso, METODOS_VALIDOS };
