const { Router } = require("express");
const { obtenerIngresosDelDia } = require("../services/tableroService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

router.get("/ingresos-dia", wrap(async (req, res) => {
  res.json({ ok: true, data: await obtenerIngresosDelDia() });
}));

module.exports = router;
