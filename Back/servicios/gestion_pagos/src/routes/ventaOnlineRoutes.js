const { Router } = require("express");
const { verificarToken } = require("../middlewares/verificarToken");
const { recibirVenta, listarVentas } = require("../services/ventaOnlineService");
const { reenviarAvisoMarketplace } = require("../services/avisoMarketplaceService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

/**
 * TDSI-51/685: via HTTP el Marketplace se identifica con su JWT de Sistema Cliente
 * (igual que el resto de la integracion, ver verificarToken.js); via Pub/Sub (TDSI-179)
 * el tópico ya es confiable por construccion, asi que esto NO duplica esa ruta, es la
 * alternativa directa para cuando no se usa el tópico. Misma validacion para ambas
 * (recibirVenta), asi que una venta ya recibida por el tópico tampoco se duplica aca.
 * El campo "email" es opcional: si la orden lo trae, al aprobarla (ver
 * /online/:id/reenviar-marketplace) se le manda ademas la factura digital a ese
 * correo (facturaDigitalService.js#enviarFacturaDeVentaOnline); sin correo, no se
 * le manda nada al cliente por ahi (solo se avisa al Marketplace).
 */
router.post("/online", verificarToken, wrap(async (req, res) => {
  const data = await recibirVenta(req.body);
  res.status(data.duplicada ? 200 : 201).json({ ok: true, data });
}));

// TDSI-51/686: listado real de "Ventas Online" para el Administrador, con filtros
// opcionales (?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&estado=Pagado|Anulado) y el detalle
// de items de cada orden. Cada venta trae tambien el correo del cliente y el estado
// del envio de su factura digital (factura_email_estado: SIMULADO/ENVIADO/ERROR).
router.get("/online/ventas", wrap(async (req, res) => {
  const data = await listarVentas({ desde: req.query.desde, hasta: req.query.hasta, estado: req.query.estado });
  res.json({ ok: true, data });
}));

// TDSI-51/957: boton "Aprobar y enviar a Marketplace" del modal "Ver factura" --
// es el momento en que la orden sale de nuestro sistema: publica el aviso Pub/Sub
// al Marketplace y, si la orden trajo correo, le manda ademas la factura digital
// al cliente (las dos son independientes entre si).
// 200 { publicado, messageId, facturaEmail } o { publicado: false, error, facturaEmail }.
// 404 si la venta no existe; 409 si todavia no tiene una factura emitida.
router.post("/online/:id/reenviar-marketplace", wrap(async (req, res) => {
  const data = await reenviarAvisoMarketplace(req.params.id);
  res.json({ ok: true, data });
}));

module.exports = router;
