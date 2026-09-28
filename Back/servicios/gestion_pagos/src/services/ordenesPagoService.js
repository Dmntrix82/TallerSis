const { AppError } = require("../utils/AppError");
const repo = require("../data/ordenesPagoRepo");

async function recibirOrdenPago(datos) {
  // TDSI-392: Validar datos completos del proveedor
  const { id, proveedor, nit, monto, fechaEmision, fechaVencimiento, concepto } = datos;

  if (!id || !proveedor || !nit || !monto || !fechaEmision || !fechaVencimiento) {
    throw new AppError("Faltan datos obligatorios en la orden de pago", 400);
  }

  if (Number(monto) <= 0) {
    throw new AppError("El monto debe ser mayor a 0", 400);
  }

  // TDSI-393: Guardar la orden de pago como 'Pendiente'
  let ordenGuardada;
  try {
    ordenGuardada = await repo.guardarOrden({
      id, proveedor, nit, monto: Number(monto), fechaEmision, fechaVencimiento, concepto
    });
  } catch (err) {
    if (err.code === '23505') { // Unique violation
      throw new AppError(`La orden de pago con ID ${id} ya existe`, 409);
    }
    throw err;
  }

  // TDSI-394: Notificar al administrador cuando llega una nueva orden pendiente
  // Aquí podríamos integrar con WebSockets, Email, o simplemente dejar un registro.
  console.log(`[NOTIFICACIÓN] Nueva orden de pago recibida de Compras: ${id} - Proveedor: ${proveedor}`);

  return {
    mensaje: "Orden de pago recibida y registrada como pendiente",
    orden: ordenGuardada
  };
}

async function listarOrdenesPendientes() {
  return await repo.obtenerOrdenesPendientes();
}

module.exports = {
  recibirOrdenPago,
  listarOrdenesPendientes
};
