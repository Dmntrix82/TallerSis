const { AppError } = require("../utils/AppError");
const repo = require("../data/pagosRepo");

// TDSI-633: a los 5 minutos sin pago, el cobro pendiente expira.
const MINUTOS_VENCIMIENTO_QR = 5;

/**
 * TDSI-39/155: crea el cobro pendiente que se muestra junto al QR fijo de
 * la cuenta (no genera ninguna imagen de QR nueva ni se conecta a ningun
 * banco -- ver nota en sql/script_pagos.sql). El cajero confirma el pago a
 * mano mas adelante (TDSI-533) despues de verlo llegar a su banco.
 */
async function crearCobroPendiente({ monto, caja_id, cajero }) {
  if (!Number.isFinite(monto) || monto <= 0) {
    throw new AppError("El monto a cobrar debe ser un número mayor a 0.", 400);
  }

  const cobro = await repo.crearCobroQr({
    monto,
    minutosVencimiento: MINUTOS_VENCIMIENTO_QR,
    caja_id,
    cajero,
  });

  return cobro;
}

/** TDSI-39/532: lo que consulta el frontend mientras espera el pago ("Esperando pago"/"Pagado"/"Expirado"). */
async function consultarEstadoCobro(id) {
  if (!/^\d+$/.test(String(id))) {
    throw new AppError("El id del cobro no es válido.", 400, { id });
  }

  const cobro = await repo.obtenerCobroQrPorId(id);
  if (!cobro) {
    throw new AppError("No existe un cobro con ese id.", 404, { id });
  }
  return cobro;
}

/**
 * TDSI-39/533: el cajero, tras ver llegar el deposito a su banco, confirma el
 * pago a mano. No hay deteccion automatica de ningun banco -- este endpoint
 * ES la confirmacion.
 */
async function confirmarPago(id, { confirmado_por }) {
  if (!/^\d+$/.test(String(id))) {
    throw new AppError("El id del cobro no es válido.", 400, { id });
  }
  if (!confirmado_por || !String(confirmado_por).trim()) {
    throw new AppError("Debe indicar quién confirma el pago.", 400);
  }

  const actualizado = await repo.confirmarCobroQr(id, String(confirmado_por).trim());
  if (actualizado) return actualizado;

  const actual = await repo.obtenerCobroQrPorId(id);
  if (!actual) {
    throw new AppError("No existe un cobro con ese id.", 404, { id });
  }
  if (actual.estado === "Pagado") {
    throw new AppError("Este cobro ya fue confirmado como pagado; no se puede confirmar dos veces.", 409, { id });
  }
  throw new AppError(`Este cobro ya no se puede confirmar (estado actual: ${actual.estado}).`, 409, { id });
}

module.exports = { crearCobroPendiente, consultarEstadoCobro, confirmarPago, MINUTOS_VENCIMIENTO_QR };
