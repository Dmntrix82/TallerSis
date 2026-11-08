const { Router } = require("express");
const { verificarToken } = require("../middlewares/verificarToken");
const { recibirVenta, listarVentas } = require("../services/ventaOnlineService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

/**
 * TDSI-51/685: via HTTP el Marketplace se identifica con su JWT de Sistema Cliente
 * (igual que el resto de la integracion, ver verificarToken.js); via Pub/Sub (TDSI-179)
 * el tópico ya es confiable por construccion, asi que esto NO duplica esa ruta, es la
 * alternativa directa para cuando no se usa el tópico. Misma validacion para ambas
 * (recibirVenta), asi que una venta ya recibida por el tópico tampoco se duplica aca.
 */
router.post("/online", verificarToken, wrap(async (req, res) => {
  const data = await recibirVenta(req.body);
  res.status(data.duplicada ? 200 : 201).json({ ok: true, data });
}));

// TDSI-51/686: listado real de "Ventas Online" para el Administrador, con filtros
// opcionales (?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&estado=Pagado|Anulado) y el detalle
// de items de cada orden.
router.get("/online/ventas", wrap(async (req, res) => {
  const data = await listarVentas({ desde: req.query.desde, hasta: req.query.hasta, estado: req.query.estado });
  res.json({ ok: true, data });
}));

module.exports = router;
