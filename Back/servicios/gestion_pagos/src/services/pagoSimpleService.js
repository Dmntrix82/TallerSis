const { AppError } = require("../utils/AppError");
const repo = require("../data/pagosRepo");
const { guardarClienteEnFacturacion } = require("./clientesProxy");

const METODOS_VALIDOS = ["Efectivo", "Tarjeta", "QR"];

/** TDSI-85/262/271/272 + TDSI-289 (via proxy a facturacion) */
async function registrarPagoSimple({ id_transaccion, metodo, monto, nit, razon_social, email }) {
  if (!id_transaccion || !metodo || monto === undefined) {
    throw new AppError("Los campos id_transaccion, metodo y monto son obligatorios.", 400);
  }
  if (!METODOS_VALIDOS.includes(metodo)) {
    throw new AppError(`El metodo "${metodo}" no esta permitido. Use: ${METODOS_VALIDOS.join(", ")}.`, 400);
  }
  if (typeof monto !== "number" || monto <= 0) {
    throw new AppError("El monto debe ser un numero mayor a 0.", 400);
  }

  const clienteAutoguardado = await guardarClienteEnFacturacion({ nit, razon_social, email });

  const pago = await repo.insertarTransaccionSimple({ id_transaccion, metodo, monto, nit, razon_social });
  const totalTransacciones = await repo.contarTransacciones();

  return { pago, totalTransacciones, clienteGuardado: clienteAutoguardado.creado, cliente: clienteAutoguardado.cliente };
}

async function obtenerHistorial() {
  const historial = await repo.listarHistorial();
  return { total: historial.length, historial };
}

module.exports = { registrarPagoSimple, obtenerHistorial, METODOS_VALIDOS };