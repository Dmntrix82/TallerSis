const { Router } = require("express");
const { obtenerResumenPorTurno } = require("../services/resumenVentasService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

router.get("/:turnoId", wrap(async (req, res) => {
  const { desde, hasta } = req.query;
  res.json({ ok: true, data: await obtenerResumenPorTurno(req.params.turnoId, { desde, hasta }) });
}));

module.exports = router;
