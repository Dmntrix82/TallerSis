const { AppError } = require("../utils/AppError");

/** TDSI-391 y TDSI-392: Servicio base y validación de la orden de pago */
async function recibirOrdenPago(payload) {
  const { ordenCompraId, montoTotal, proveedor } = payload;

  // 1. Validaciones base de la orden
  if (!ordenCompraId) {
    throw new AppError("El campo 'ordenCompraId' es obligatorio", 400);
  }
  if (typeof montoTotal !== 'number' || montoTotal <= 0) {
    throw new AppError("El 'montoTotal' debe ser un número mayor a cero", 400);
  }
  
  // 2. Validación estricta de los datos del proveedor (TDSI-392)
  if (!proveedor || typeof proveedor !== 'object') {
    throw new AppError("Los datos del 'proveedor' son obligatorios y deben venir en un objeto", 400);
  }
  if (!proveedor.id || !proveedor.nombre || !proveedor.cuentaBancaria) {
    throw new AppError("El proveedor debe incluir obligatoriamente 'id', 'nombre' y 'cuentaBancaria'", 400);
  }

  // La persistencia en BD (TDSI-393) irá aquí en el próximo paso

  console.log(`[OrdenPago] Solicitud válida de Compras. Orden: ${ordenCompraId} | Proveedor: ${proveedor.nombre}`);

  return { 
    recibida: true, 
    ordenCompraId,
    mensaje: "Orden de pago validada exitosamente"
  };
}

module.exports = { recibirOrdenPago };