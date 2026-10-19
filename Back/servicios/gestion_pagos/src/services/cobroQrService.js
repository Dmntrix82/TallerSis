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

module.exports = { crearCobroPendiente, MINUTOS_VENCIMIENTO_QR };
