const { Router } = require("express");
const service = require("../services/diferenciaService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-141 / TDSI-489: Listar diferencias con filtros
router.get("/", wrap(async (req, res) => {
  const data = await service.listar({
    estado: req.query.estado,
    tipo: req.query.tipo,
    caja_id: req.query.caja_id,
  });
  res.json({ ok: true, total: data.length, data });
}));

// TDSI-141 / TDSI-488: Resolver diferencia
router.post("/:id/resolver", wrap(async (req, res) =>
  res.json({
    ok: true,
    mensaje: "Diferencia resuelta correctamente",
    data: await service.resolver(req.params.id, req.body),
  })
));

module.exports = router;
