const { Router } = require("express");
const service = require("../services/comparacionService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-139/485: GET /api/caja/comparacion?fecha=YYYY-MM-DD&caja_id=X&cajero_id=Y&tipo=Z
router.get("/", wrap(async (req, res) => {
  const data = await service.listarComparacion({
    fecha: req.query.fecha,
    caja_id: req.query.caja_id,
    cajero_id: req.query.cajero_id,
    tipo_diferencia: req.query.tipo,
  });
  res.json({ ok: true, data });
}));

module.exports = router;
