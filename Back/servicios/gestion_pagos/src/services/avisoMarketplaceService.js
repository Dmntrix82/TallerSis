const { publicar } = require("../clients/pubsubPublisher");
const cfg = require("../config/marketplace");
const repo = require("../data/ventasOnlineRepo");
const { obtenerOCrearTokenVentaOnline, urlVerificacion } = require("./verificacionFacturaService");

/**
 * TDSI-51/684: avisa al Marketplace que la factura de su orden ya se emitio, publicando
 * en "pagos-facturas-emitidas" el N de orden, el N de factura y el enlace publico
 * "Verificar Factura" (mismo token+QR que las ventas de mostrador, TDSI-38/527). Guarda
 * el resultado (Enviado/Error) en la propia venta. Sin topico configurado no se intenta
 * ni se registra nada (desarrollo local sin credenciales) -- igual que Contabilidad.
 */
async function avisarFacturaEmitida({ id, orden_id, numero_factura }) {
  if (!cfg.FACTURAS_TOPIC) return { publicado: false, motivo: "MARKETPLACE_FACTURAS_TOPIC no esta configurado" };

  const token = await obtenerOCrearTokenVentaOnline(id);
  const mensaje = {
    ordenId: orden_id,
    numeroFactura: numero_factura,
    enlaceVerificacion: urlVerificacion(token),
  };

  const r = await publicar(mensaje, { tipo: "FACTURA_EMITIDA", orden_id, numero_factura });
  await repo.guardarAvisoMarketplace(id, { estado: r.ok ? "Enviado" : "Error", error: r.ok ? null : r.error });
  return { publicado: r.ok, ...(r.ok ? { messageId: r.messageId } : { error: r.error }) };
}

module.exports = { avisarFacturaEmitida };
