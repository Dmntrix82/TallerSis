const { AppError } = require("../utils/AppError");
const { aCentavos, aMonto } = require("../utils/money");

/** TDSI-40/157: subtotal de un item (cantidad x precio unitario), en centavos para no perder precision. */
function subtotalItemEnCentavos({ cantidad, precio_unitario }) {
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    throw new AppError("La cantidad de cada ítem debe ser un número mayor a 0.", 400, { cantidad });
  }
  if (!Number.isFinite(precio_unitario) || precio_unitario <= 0) {
    throw new AppError("El precio unitario de cada ítem debe ser un número mayor a 0.", 400, { precio_unitario });
  }
  return aCentavos(cantidad * precio_unitario);
}

/** Subtotal de un item individual, en Bs. */
function calcularSubtotalItem(item) {
  return aMonto(subtotalItemEnCentavos(item));
}

/** TDSI-40/157: subtotal de la factura completa = suma de subtotales de sus ítems. */
function calcularSubtotalFactura(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError("La factura debe tener al menos un ítem.", 400);
  }
  const subtotalC = items.reduce((acc, item) => acc + subtotalItemEnCentavos(item), 0);
  return aMonto(subtotalC);
}

module.exports = { calcularSubtotalItem, calcularSubtotalFactura };
