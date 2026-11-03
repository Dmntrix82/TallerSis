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
 * TDSI-159: Divide un monto de vuelto en la menor cantidad posible de
 * billetes y monedas de Bolivia.
 * Retorna un array de objetos: [{ denominacion: 100, cantidad: 1 }, ...]
 */
function calcularDesgloseVuelto(vuelto) {
  if (!vuelto || vuelto <= 0) return [];

  // Las denominaciones permitidas (billetes y monedas)
  const denominaciones = [200, 100, 50, 20, 10, 5, 2, 1, 0.50, 0.20, 0.10];
  
  // Convertimos el vuelto a centavos para evitar problemas de punto flotante
  let restanteCentavos = Math.round(vuelto * 100);
  const desglose = [];

  for (const denom of denominaciones) {
    const denomCentavos = Math.round(denom * 100);
    const cantidad = Math.floor(restanteCentavos / denomCentavos);

    if (cantidad > 0) {
      desglose.push({
        denominacion: denom,
        cantidad: cantidad
      });
      restanteCentavos -= cantidad * denomCentavos;
    }
  }

  return desglose;
}
/**
 * TDSI-548: el efectivo que entrega el cliente no puede ser menor al total
 * a cobrar (no se puede dar un vuelto negativo).
 */
function validarMontoRecibido(total, montoRecibido) {
  if (!Number.isFinite(total) || total <= 0) {
    throw new AppError("El total a cobrar debe ser un número mayor a 0.", 400);
  }
  if (!Number.isFinite(montoRecibido) || montoRecibido <= 0) {
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

module.exports = { calcularVuelto, validarMontoRecibido, calcularDesgloseVuelto };
