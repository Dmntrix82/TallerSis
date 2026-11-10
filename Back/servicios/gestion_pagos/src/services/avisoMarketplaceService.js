const { publicar } = require("../clients/pubsubPublisher");
const cfg = require("../config/marketplace");
const repo = require("../data/ventasOnlineRepo");
const { obtenerOCrearTokenVentaOnline, urlVerificacion } = require("./verificacionFacturaService");
const { AppError } = require("../utils/AppError");

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
    // Fecha/hora exacta del aviso (el Marketplace la pidió clara en el cuerpo del mensaje,
    // igual que ya la tienen los mensajes hacia Compras y Contabilidad).
    emitidoEn: new Date().toISOString(),
  };

  const r = await publicar(cfg.FACTURAS_TOPIC, mensaje, { tipo: "FACTURA_EMITIDA", orden_id, numero_factura });
  await repo.guardarAvisoMarketplace(id, { estado: r.ok ? "Enviado" : "Error", error: r.ok ? null : r.error });
  return { publicado: r.ok, ...(r.ok ? { messageId: r.messageId } : { error: r.error }) };
}

/**
 * TDSI-51: boton "Enviar a Marketplace" del modal de factura del Administrador --
 * reenvia (o envia por primera vez, si por algun motivo nunca se intento) el mismo
 * aviso por Pub/Sub, para poder demostrar la integracion sin esperar una orden nueva.
 * Solo tiene sentido si la orden ya tiene una factura emitida.
 */
async function reenviarAvisoMarketplace(ventaId) {
  const venta = await repo.obtenerVentaPorId(ventaId);
  if (!venta) throw new AppError("No existe una venta online con ese id.", 404, { id: ventaId });
  if (!venta.numero_factura) {
    throw new AppError("Esta orden todavía no tiene una factura emitida; no hay nada que avisar al Marketplace.", 409, { id: ventaId });
  }
  return avisarFacturaEmitida({ id: venta.id, orden_id: venta.orden_id, numero_factura: venta.numero_factura });
}

module.exports = { avisarFacturaEmitida, reenviarAvisoMarketplace };
