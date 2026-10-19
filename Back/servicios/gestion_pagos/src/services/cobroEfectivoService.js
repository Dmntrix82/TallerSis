const { AppError } = require("../utils/AppError");

/**
 * TDSI-29/547: cuanto vuelto hay que entregar cuando el cajero cobra en
 * efectivo. Redondea a 2 decimales para evitar arrastrar errores de punto
 * flotante (ej. 0.1 + 0.2).
 */
function calcularVuelto(total, montoRecibido) {
  return Math.round((montoRecibido - total) * 100) / 100;
}

/**
 * TDSI-548: el efectivo que entrega el cliente no puede ser menor al total
 * a cobrar (no se puede dar un vuelto negativo).
 */
function validarMontoRecibido(total, montoRecibido) {
  if (typeof total !== "number" || total <= 0) {
    throw new AppError("El total a cobrar debe ser un número mayor a 0.", 400);
  }
  if (typeof montoRecibido !== "number" || montoRecibido <= 0) {
    throw new AppError("El monto recibido debe ser un número mayor a 0.", 400);
  }
  if (montoRecibido < total) {
    throw new AppError(
      `El monto recibido (${montoRecibido.toFixed(2)}) es menor al total a cobrar (${total.toFixed(2)}).`,
      400,
      { total, monto_recibido: montoRecibido }
    );
  }
}

module.exports = { calcularVuelto, validarMontoRecibido };
