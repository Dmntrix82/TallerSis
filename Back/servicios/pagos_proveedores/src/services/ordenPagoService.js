const { AppError } = require("../utils/AppError");
const repo = require("../data/ordenesPagoRepo");

const CONCEPTO_MAX = 200;

// TDSI-392: fecha de vencimiento opcional, pero si viene debe ser un dia real "YYYY-MM-DD"
function normalizarFechaVencimiento(valor) {
  if (valor === undefined || valor === null || valor === "") return null;
  const texto = typeof valor === "string" ? valor.trim() : "";
  const esDiaReal = /^\d{4}-\d{2}-\d{2}$/.test(texto) &&
    new Date(`${texto}T00:00:00Z`).toISOString().slice(0, 10) === texto;
  if (!esDiaReal) {
    throw new AppError("La 'fechaVencimiento' debe ser una fecha valida con formato YYYY-MM-DD", 400, { fechaVencimiento: valor });
  }
  return texto;
}

// TDSI-392: concepto opcional, texto de hasta CONCEPTO_MAX caracteres
function normalizarConcepto(valor) {
  if (valor === undefined || valor === null || valor === "") return null;
  if (typeof valor !== "string" || valor.trim().length > CONCEPTO_MAX) {
    throw new AppError(`El 'concepto' debe ser texto de maximo ${CONCEPTO_MAX} caracteres`, 400);
  }
  return valor.trim();
}

async function recibirOrdenPago(payload) {
  const { numero, ordenCompraId, monto, proveedor } = payload;

  // TDSI-392: Validaciones
  if (!numero || !ordenCompraId) throw new AppError("Los campos 'numero' y 'ordenCompraId' son obligatorios", 400);
  if (typeof monto !== 'number' || monto <= 0) throw new AppError("El 'monto' debe ser un número mayor a cero", 400);
  
  if (!proveedor || typeof proveedor !== 'object') throw new AppError("Los datos del proveedor son obligatorios", 400);
  if (!proveedor.nit || !proveedor.razonSocial || !proveedor.cuentaBancaria || !proveedor.banco) {
    throw new AppError("El proveedor debe incluir nit, razonSocial, cuentaBancaria y banco", 400);
  }
  const fechaVencimiento = normalizarFechaVencimiento(payload.fechaVencimiento);
  const concepto = normalizarConcepto(payload.concepto);

  // TDSI-393: Persistencia y evitar duplicados
  const existe = await repo.existeOrden(ordenCompraId);
  if (existe) {
    throw new AppError("Esta orden de compra ya fue recibida y registrada anteriormente", 409, { ordenCompraId });
  }

  const ordenGuardada = await repo.guardarOrdenPendiente({ ...payload, fechaVencimiento, concepto });

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

// TDSI-116 / TDSI-395: lista de ordenes pendientes para la bandeja del administrador
async function listarOrdenesPendientes() {
  return repo.listarPendientes();
}

module.exports = { recibirOrdenPago, listarOrdenesPendientes };