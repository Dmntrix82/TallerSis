const { AppError } = require("../utils/AppError");
const pagosRepo = require("../data/pagosRepo");
const facturaEmailRepo = require("../data/facturaEmailRepo");
const { enviarFacturaPorCorreo } = require("./emailService");

// Datos fijos del negocio para el encabezado de la factura digital.
const EMPRESA = { nombre: "TallerSis", direccion: "Av. Principal s/n, Bolivia" };
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Extension de TDSI-107/108: en este proyecto todavia no hay catalogo de productos,
 * asi que la factura digital NO tiene detalle de items -- solo lo que la venta
 * realmente registra: comprobante, cliente (si se indico NIT/Razon Social al pagar)
 * y el desglose de metodos de pago (uno solo si es Simple, varios si es Mixto).
 */
async function construirFacturaDigital(id_transaccion) {
  const transacciones = await pagosRepo.buscarTransaccionesPorIdTransaccion(id_transaccion);
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
      caja_id: primera.caja_id,
      tipo_pago: primera.tipo_pago,
    },
    cliente: {
      nit: primera.nit || null,
      razon_social: primera.razon_social || "Consumidor final",
    },
    pagos: transacciones.map((t) => ({ metodo: t.metodo, monto: t.monto })),
    total,
  };
}

/** El cajero pregunta "¿enviar factura por correo?" justo despues de pagar; esto la arma y la manda. */
async function enviarFacturaDeTransaccion(id_transaccion, email) {
  if (!email || !EMAIL_REGEX.test(String(email).trim())) {
    throw new AppError("Ingrese un correo válido para enviar la factura.", 400, { email });
  }

  const factura = await construirFacturaDigital(id_transaccion);
  const resultado = await enviarFacturaPorCorreo({ email: email.trim(), factura });

  const envio = await facturaEmailRepo.registrarEnvio({
    id_transaccion,
    email: email.trim(),
    estado: resultado.estado,
    payload: factura,
  });

  return { factura, envio };
}

module.exports = { construirFacturaDigital, enviarFacturaDeTransaccion };
