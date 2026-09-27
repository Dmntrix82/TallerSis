const { Router } = require("express");
const { obtenerResumenPorTurno } = require("../services/resumenVentasService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

router.get("/:turnoId", wrap(async (req, res) => {
  res.json({ ok: true, data: await obtenerResumenPorTurno(req.params.turnoId) });
}));

module.exports = router;
