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

  let cobro = await repo.obtenerCobroQrPorId(id);
  if (!cobro) {
    throw new AppError("No existe un cobro con ese id.", 404, { id });
  }

  // TDSI-534: si ya paso el expira_en y nadie lo habia marcado todavia, se
  // marca recien aqui -- asi el frontend que consulta periodicamente es
  // quien dispara la transicion a Expirado.
  if (cobro.estado === "Pendiente" && new Date(cobro.expira_en) <= new Date()) {
    cobro = (await repo.expirarCobroQrSiVencido(id)) || cobro;
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

  // No se confirmo: averiguar por que para dar un mensaje claro. Si ya
  // vencio su expira_en, se marca Expirado recien aqui (TDSI-534) en vez de
  // dejarlo "Pendiente" a secas, que seria enganoso.
  let actual = await repo.obtenerCobroQrPorId(id);
  if (!actual) {
    throw new AppError("No existe un cobro con ese id.", 404, { id });
  }
  if (actual.estado === "Pendiente" && new Date(actual.expira_en) <= new Date()) {
    actual = (await repo.expirarCobroQrSiVencido(id)) || actual;
  }

  if (actual.estado === "Pagado") {
    throw new AppError("Este cobro ya fue confirmado como pagado; no se puede confirmar dos veces.", 409, { id });
  }
  if (actual.estado === "Expirado") {
    throw new AppError("Este cobro QR expiró (pasaron más de 5 minutos); genere uno nuevo para cobrar.", 409, { id });
  }
  throw new AppError(`Este cobro ya no se puede confirmar (estado actual: ${actual.estado}).`, 409, { id });
}

module.exports = { crearCobroPendiente, consultarEstadoCobro, confirmarPago, MINUTOS_VENCIMIENTO_QR };
