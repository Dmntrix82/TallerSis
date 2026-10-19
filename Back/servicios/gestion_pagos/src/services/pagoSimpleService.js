const { AppError } = require("../utils/AppError");
const repo = require("../data/pagosRepo");
const { guardarClienteEnFacturacion } = require("./clientesProxy");
const { emitirActualizacion } = require("../utils/tableroEvents");
const { TIPOS_DOCUMENTO_VALIDOS, validarFormatoDocumento } = require("../utils/documento");
const { calcularVuelto, validarMontoRecibido } = require("./cobroEfectivoService");

const METODOS_VALIDOS = ["Efectivo", "Tarjeta", "QR"];

/**
 * TDSI-85/262/271/272 + TDSI-289 (via proxy a facturacion)
 * El ID de transaccion ya no viene del cajero: lo genera insertarTransaccionSimple.
 * tipo_documento es opcional: null/ausente = "sin datos de facturacion" (venta
 * sin factura); si se elige NIT o CI, el numero y la razon social son obligatorios.
 */
async function registrarPagoSimple({ metodo, monto, tipo_documento, nit, razon_social, telefono, email, caja_id, turno_id, cajero, monto_recibido }) {
  if (!metodo || monto === undefined) {
    throw new AppError("Los campos metodo y monto son obligatorios.", 400);
  }
  if (!METODOS_VALIDOS.includes(metodo)) {
    throw new AppError(`El metodo "${metodo}" no esta permitido. Use: ${METODOS_VALIDOS.join(", ")}.`, 400);
  }
  if (typeof monto !== "number" || monto <= 0) {
    throw new AppError("El monto debe ser un numero mayor a 0.", 400);
  }

  // TDSI-29/550: si pagan en efectivo y mandan cuanto entregó el cliente, se
  // vuelve a validar y calcular el vuelto aquí mismo (nunca se confía en un
  // vuelto que mande el frontend ya calculado) y se guarda junto al cobro.
  let vuelto = null;
  if (metodo === "Efectivo" && monto_recibido !== undefined && monto_recibido !== null) {
    validarMontoRecibido(monto, monto_recibido);
    vuelto = calcularVuelto(monto, monto_recibido);
  }

  const tipoDocumento = tipo_documento || null;
  if (tipoDocumento && !TIPOS_DOCUMENTO_VALIDOS.includes(tipoDocumento)) {
    throw new AppError(`El tipo de documento debe ser NIT, CI, o no indicarse.`, 400);
  }
  if (tipoDocumento) {
    if (!nit || !razon_social) {
      throw new AppError(`Si elige ${tipoDocumento}, el número de documento y la razón social son obligatorios.`, 400);
    }
    const errorFormato = validarFormatoDocumento(tipoDocumento, nit);
    if (errorFormato) {
      throw new AppError(errorFormato, 400, { [tipoDocumento.toLowerCase()]: nit });
    }
  }

  // Solo el NIT alimenta el registro de clientes frecuentes de facturacion:
  // esa tabla es para clientes de negocio (con NIT), no para consumidores con CI.
  const clienteAutoguardado = tipoDocumento === "NIT"
    ? await guardarClienteEnFacturacion({ nit, razon_social, email })
    : { creado: false, cliente: null };

  const pago = await repo.insertarTransaccionSimple({
    metodo,
    monto,
    nit: tipoDocumento ? nit : null,
    razon_social: tipoDocumento ? razon_social : null,
    tipo_documento: tipoDocumento,
    telefono,
    caja_id,
    turno_id,
    cajero,
    monto_recibido: metodo === "Efectivo" ? monto_recibido ?? null : null,
    vuelto,
  });
  const totalTransacciones = await repo.contarTransacciones();
  emitirActualizacion();

  return { pago, totalTransacciones, clienteGuardado: clienteAutoguardado.creado, cliente: clienteAutoguardado.cliente };
}

async function obtenerHistorial() {
  const historial = await repo.listarHistorial();
  return { total: historial.length, historial };
}

/**
 * Autocompletado de razon social: si el NIT/CI ya se uso en un pago anterior
 * (simple o mixto), se devuelve la razon social que se registro esa vez.
 */
async function buscarClientePorDocumento(tipo_documento, numero) {
  if (!TIPOS_DOCUMENTO_VALIDOS.includes(tipo_documento)) {
    throw new AppError("El tipo de documento debe ser NIT o CI.", 400);
  }
  const errorFormato = validarFormatoDocumento(tipo_documento, numero);
  if (errorFormato) {
    throw new AppError(errorFormato, 400);
  }
  const razon_social = await repo.buscarRazonSocialPorDocumento(tipo_documento, String(numero).trim());
  return { razon_social };
}

module.exports = { registrarPagoSimple, obtenerHistorial, buscarClientePorDocumento, METODOS_VALIDOS };