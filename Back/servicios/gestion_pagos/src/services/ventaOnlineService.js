const { AppError } = require("../utils/AppError");
const repo = require("../data/ventasOnlineRepo");

/**
 * TDSI-343: recibe el JSON con el detalle de la venta online.
 * Etapa inicial: valida que llegue algo y que la orden no este duplicada.
 * La validacion completa de campos (TDSI-344) y la persistencia (TDSI-345)
 * se agregan en las siguientes subtareas.
 */
async function recibirVenta(json) {
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    throw new AppError("El cuerpo de la peticion debe ser un objeto JSON", 400);
  }
  if (!json.ordenId) {
    throw new AppError("El campo 'ordenId' es obligatorio", 400);
  }

  if (await repo.existeOrden(json.ordenId)) {
    throw new AppError("La orden ya fue recibida anteriormente", 409, { ordenId: json.ordenId });
  }

  console.log("[venta-online] JSON recibido:", JSON.stringify(json));

  return { recibido: true, ordenId: json.ordenId };
}

module.exports = { recibirVenta };