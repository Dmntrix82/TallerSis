const { AppError } = require("../utils/AppError");
const repo = require("../data/ordenesPagoRepo");

async function recibirOrdenPago(payload) {
  const { numero, ordenCompraId, monto, proveedor } = payload;

  // TDSI-392: Validaciones
  if (!numero || !ordenCompraId) throw new AppError("Los campos 'numero' y 'ordenCompraId' son obligatorios", 400);
  if (typeof monto !== 'number' || monto <= 0) throw new AppError("El 'monto' debe ser un número mayor a cero", 400);
  
  if (!proveedor || typeof proveedor !== 'object') throw new AppError("Los datos del proveedor son obligatorios", 400);
  if (!proveedor.nit || !proveedor.razonSocial || !proveedor.cuentaBancaria || !proveedor.banco) {
    throw new AppError("El proveedor debe incluir nit, razonSocial, cuentaBancaria y banco", 400);
  }

  // TDSI-393: Persistencia y evitar duplicados
  const existe = await repo.existeOrden(ordenCompraId);
  if (existe) {
    throw new AppError("Esta orden de compra ya fue recibida y registrada anteriormente", 409, { ordenCompraId });
  }

  const ordenGuardada = await repo.guardarOrdenPendiente(payload);

  // TDSI-394: Guardar notificación en BD (Sin llamadas HTTP)
  const mensajeNotificacion = `Nueva orden ${numero} pendiente para ${proveedor.razonSocial} por BOB ${monto}`;
  await repo.guardarNotificacionAdmin(ordenGuardada.id, mensajeNotificacion);

  console.log(`[PagosProveedores] Orden ${ordenCompraId} PENDIENTE. Notificación guardada en BD.`);

  return { 
    recibida: true, 
    ordenCompraId,
    estado: ordenGuardada.estado,
    mensaje: "Orden de pago procesada y notificada con éxito"
  };
}

module.exports = { recibirOrdenPago };