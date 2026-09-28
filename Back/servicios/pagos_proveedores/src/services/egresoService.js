const { AppError } = require("../utils/AppError");
const egresosRepo = require("../data/egresosRepo");
const { validarOrdenPagable, liquidarOrden } = require("./ordenPagoService");
const { actualizarFlujoTrasEgreso } = require("./flujoCajaService");

const METODOS_VALIDOS = ["TRANSFERENCIA", "CHEQUE", "EFECTIVO"];

/** TDSI-399/400: registra el egreso vinculado a su orden de pago y la marca liquidada */
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

  const ordenPendiente = await validarOrdenPagable(orden_pago_id);

  // TDSI-406: el monto pagado debe coincidir con lo adeudado en la orden (tolerancia de 1 centavo).
  const montoAdeudado = Number(ordenPendiente.monto);
  if (Math.abs(montoAdeudado - monto) > 0.01) {
    throw new AppError(
      `El monto pagado (${monto.toFixed(2)}) no coincide con el monto adeudado (${montoAdeudado.toFixed(2)}).`,
      422,
      { monto_pagado: monto, monto_adeudado: montoAdeudado }
    );
  }

  const egreso = await egresosRepo.insertarEgreso({ orden_pago_id, monto, metodo: metodoFinal, descripcion, registrado_por });
  const orden = await liquidarOrden(orden_pago_id, registrado_por);
  const flujoDia = await actualizarFlujoTrasEgreso(monto);

  return { egreso, orden, flujoDia };
}

/** TDSI-402: historial de egresos (movimientos financieros de este esquema) */
async function obtenerHistorial() {
  const historial = await egresosRepo.listarEgresos();
  return { total: historial.length, historial };
}

module.exports = { registrarEgreso, obtenerHistorial, METODOS_VALIDOS };
