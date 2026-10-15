const { Router } = require("express");
const service = require("../services/recaudadoService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-137: GET /api/caja/recaudado?caja_id=X&desde=...&hasta=...
// Sin caja_id → totales por cada caja activa.
// Con caja_id → totales de esa caja.
router.get("/", wrap(async (req, res) => {
  const data = await service.calcularRecaudadoPorCaja({
    caja_id: req.query.caja_id,
    desde: req.query.desde,
    hasta: req.query.hasta,
  });
  res.json({ ok: true, data });
}));

module.exports = router;