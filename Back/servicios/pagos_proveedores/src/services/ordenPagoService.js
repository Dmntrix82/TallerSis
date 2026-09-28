const { AppError } = require("../utils/AppError");
const ordenesPagoRepo = require("../data/ordenesPagoRepo");

async function recibirOrdenPago(payload) {
  const { numero, ordenCompraId, monto, proveedor } = payload;

  if (!numero || !ordenCompraId)
    throw new AppError("Los campos 'numero' y 'ordenCompraId' son obligatorios", 400);
  if (typeof monto !== "number" || monto <= 0)
    throw new AppError("El 'monto' debe ser un número mayor a cero", 400);

  if (!proveedor || typeof proveedor !== "object")
    throw new AppError("Los datos del proveedor son obligatorios", 400);
  if (!proveedor.nit || !proveedor.razonSocial || !proveedor.cuentaBancaria || !proveedor.banco)
    throw new AppError("El proveedor debe incluir nit, razonSocial, cuentaBancaria y banco", 400);

  const existe = await ordenesPagoRepo.existeOrden(ordenCompraId);
  if (existe)
    throw new AppError(
      "Esta orden de compra ya fue recibida y registrada anteriormente",
      409,
      { ordenCompraId }
    );

  const ordenGuardada = await ordenesPagoRepo.guardarOrdenPendiente(payload);

  const mensajeNotificacion = `Nueva orden ${numero} pendiente para ${proveedor.razonSocial} por BOB ${monto}`;
  await ordenesPagoRepo.guardarNotificacionAdmin(ordenGuardada.id, mensajeNotificacion);

  console.log(`[PagosProveedores] Orden ${ordenCompraId} PENDIENTE. Notificación guardada en BD.`);

  return {
    recibida: true,
    ordenCompraId,
    estado: ordenGuardada.estado,
    mensaje: "Orden de pago procesada y notificada con éxito",
  };
}

/** TDSI-404: consulta la orden por numero */
async function consultarOrdenPorNumero(numero) {
  const orden = await ordenesPagoRepo.buscarPorNumero(numero);
  if (!orden) throw new AppError(`La orden de pago "${numero}" no existe.`, 404, { numero });
  return orden;
}

/** TDSI-400: valida que la orden exista y este pendiente antes de vincular el egreso */
async function validarOrdenPagable(orden_pago_id) {
  const orden = await ordenesPagoRepo.buscarPorId(orden_pago_id);
  if (!orden) throw new AppError(`La orden de pago "${orden_pago_id}" no existe.`, 404);
  if (orden.estado !== "PENDIENTE")
    throw new AppError(`La orden de pago "${orden.numero}" ya fue liquidada.`, 409);
  return orden;
}

async function liquidarOrden(orden_pago_id, liquidada_por) {
  return ordenesPagoRepo.marcarLiquidada(orden_pago_id, liquidada_por);
}

module.exports = {
  recibirOrdenPago,
  consultarOrdenPorNumero,
  validarOrdenPagable,
  liquidarOrden,
};