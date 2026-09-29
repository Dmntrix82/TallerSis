const crypto = require("crypto");
const { AppError } = require("../utils/AppError");
const pagosRepo = require("../data/pagosRepo");
const facturaEmailRepo = require("../data/facturaEmailRepo");
const { enviarFacturaPorCorreo } = require("./emailService");
const { generarFacturaPdfBuffer } = require("./facturaPdfService");

// Datos fijos del negocio para el encabezado de la factura digital.
// NIT simulado: este proyecto es academico y no tiene integracion real con el SIN.
const EMPRESA = { nombre: "TallerSis", direccion: "Av. Principal s/n, Bolivia", nit: "1009876015" };
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Codigo cosmetico para el QR/pie de la factura (no es una validacion fiscal real, es solo de verificacion interna). */
function generarCodigoVerificacion(id_transaccion, fecha) {
  return crypto
    .createHash("sha256")
    .update(`${id_transaccion}|${fecha}`)
    .digest("hex")
    .slice(0, 32)
    .toUpperCase();
}

/**
 * Extension de TDSI-107/108: en este proyecto todavia no hay catalogo de productos,
 * asi que la factura digital NO tiene detalle de items -- solo lo que la venta
 * realmente registra: comprobante, cliente (si se indico NIT/Razon Social al pagar)
 * y el desglose de metodos de pago (uno solo si es Simple, varios si es Mixto).
 * TDSI-303: se agrega caja/cajero que emitio la venta y un codigo de verificacion
 * para poder imprimir la factura o mandarla en PDF con esos datos.
 */
async function construirFacturaDigital(id_transaccion) {
  // Sin filtrar por estado: una venta anulada debe poder seguir viendose/imprimiendose
  // (marcada como anulada), no desaparecer como si nunca se hubiera registrado.
  const transacciones = await pagosRepo.buscarTodasTransaccionesPorIdTransaccion(id_transaccion);
  if (!transacciones.length) {
    throw new AppError(`No existe una transaccion registrada con id "${id_transaccion}".`, 404, { id_transaccion });
  }

  const primera = transacciones[0];
  const total = transacciones.reduce((acc, t) => acc + t.monto, 0);

  return {
    empresa: EMPRESA,
    comprobante: {
      id_transaccion,
      fecha: primera.fecha,
      caja_id: primera.caja_id || null,
      cajero: primera.cajero || null,
      tipo_pago: primera.tipo_pago,
      codigoVerificacion: generarCodigoVerificacion(id_transaccion, primera.fecha),
      anulada: primera.estado === "Anulado",
    },
    cliente: {
      nit: primera.nit || null,
      razon_social: primera.razon_social || "Consumidor final",
    },
    pagos: transacciones.map((t) => ({ metodo: t.metodo, monto: t.monto })),
    total,
  };
}

/**
 * El cajero pregunta "¿enviar factura por correo?" justo despues de pagar; esto la arma,
 * genera el PDF de la factura (TDSI-303) y la manda con ese PDF adjunto.
 */
async function enviarFacturaDeTransaccion(id_transaccion, email) {
  if (!email || !EMAIL_REGEX.test(String(email).trim())) {
    throw new AppError("Ingrese un correo válido para enviar la factura.", 400, { email });
  }

  const factura = await construirFacturaDigital(id_transaccion);
  const pdfBuffer = await generarFacturaPdfBuffer(factura);
  const resultado = await enviarFacturaPorCorreo({ email: email.trim(), factura, pdfBuffer });

  const envio = await facturaEmailRepo.registrarEnvio({
    id_transaccion,
    email: email.trim(),
    estado: resultado.estado,
    payload: factura,
  });

  return { factura, envio };
}

module.exports = { construirFacturaDigital, enviarFacturaDeTransaccion };
