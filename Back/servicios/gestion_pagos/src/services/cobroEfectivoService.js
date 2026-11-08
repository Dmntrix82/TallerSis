const { AppError } = require("../utils/AppError");
const tipoCambioService = require("./tipoCambioService");

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
 *
 * TDSI-787: en Bolivia no existe moneda menor a Bs 0.10, asi que si el vuelto
 * trae un residuo mas chico (ej. por un pago mixto dividido por porcentaje),
 * se redondea al multiplo de 0.10 mas cercano antes de repartirlo -- mismo
 * redondeo comercial que se usa en caja fisica. Sin esto, esos centavos se
 * perdian en silencio (el desglose quedaba incompleto frente al vuelto
 * mostrado). El vuelto "exacto" que se guarda en la venta (calcularVuelto)
 * no se toca: esto solo afecta la sugerencia de billetes/monedas.
 */
function calcularDesgloseVuelto(vuelto) {
  if (!vuelto || vuelto <= 0) return [];

  // Las denominaciones permitidas (billetes y monedas)
  const denominaciones = [200, 100, 50, 20, 10, 5, 2, 1, 0.50, 0.20, 0.10];

  // Convertimos el vuelto a centavos para evitar problemas de punto flotante,
  // y redondeamos al multiplo de 10 centavos mas cercano (TDSI-787).
  let restanteCentavos = Math.round(vuelto * 100 / 10) * 10;
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

/**
 * TDSI-812: Calcula el cobro cuando el cliente paga en dólares.
 * Convierte el total a Bs usando el tipo de cambio, calcula el vuelto en Bs y
 * devuelve los datos necesarios para guardar en la base de datos (TDSI-813).
 */
async function calcularCobroUsd({ total, dolaresRecibidos }) {
  if (!Number.isFinite(total) || total <= 0) {
    throw new AppError("El total a cobrar debe ser mayor a 0.", 400);
  }
  if (!Number.isFinite(dolaresRecibidos) || dolaresRecibidos <= 0) {
    throw new AppError("Los dólares recibidos deben ser mayores a 0.", 400);
  }

  const { valor: tipoCambio } = await tipoCambioService.obtenerTipoCambio();

  // Convertimos todo a centavos para evitar errores de punto flotante
  const totalCentavos = Math.round(total * 100);
  const dolaresCentavos = Math.round(dolaresRecibidos * 100);
  const tipoCambioCentavos = Math.round(tipoCambio * 100);

  // total en Bs que equivalen a los dólares recibidos (USD * TC)
  const equivalenteCentavos = Math.round((dolaresCentavos * tipoCambioCentavos) / 100);

  if (equivalenteCentavos < totalCentavos) {
    const faltanteCentavos = totalCentavos - equivalenteCentavos;
    const faltanteBs = faltanteCentavos / 100;
    throw new AppError(
      `Los dólares recibidos (${dolaresRecibidos} USD = Bs ${(equivalenteCentavos / 100).toFixed(2)}) no alcanzan para cubrir el total (Bs ${total.toFixed(2)}). Faltan Bs ${faltanteBs.toFixed(2)}.`,
      400,
      { faltanteBs }
    );
  }

  const vueltoCentavos = equivalenteCentavos - totalCentavos;
  const vuelto = vueltoCentavos / 100;
  const totalConvertido = equivalenteCentavos / 100;

  return {
    totalBs: total,
    dolaresRecibidos,
    tipoCambio,
    equivalenteBs: totalConvertido, // El total cubierto por los dólares
    vuelto,
    desgloseVuelto: calcularDesgloseVuelto(vuelto),
  };
}

module.exports = {
  calcularVuelto,
  validarMontoRecibido,
  calcularDesgloseVuelto,
  calcularCobroUsd
};
