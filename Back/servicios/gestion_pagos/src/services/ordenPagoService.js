// src/services/ordenPagoService.js
const { AppError } = require("../utils/AppError");

/** TDSI-391: Servicio base para recibir órdenes de pago del módulo de Compras */
async function recibirOrdenPago(payload) {
  // Las validaciones de proveedor (TDSI-392) y persistencia (TDSI-393) 
  // las inyectaremos aquí en los próximos pasos.

  console.log(`[OrdenPago] Solicitud entrante del módulo de Compras recibida.`);

  return { 
    recibida: true, 
    mensaje: "Endpoint de órdenes de pago conectado exitosamente",
    datos: payload
  };
}

module.exports = { recibirOrdenPago };