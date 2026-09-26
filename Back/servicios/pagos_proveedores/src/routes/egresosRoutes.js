const { Router } = require("express");
const { registrarEgreso } = require("../services/egresoService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

router.post("/", wrap(async (req, res) => {
  const egreso = await registrarEgreso(req.body);
  res.status(201).json({ ok: true, mensaje: "Egreso registrado", data: egreso });
}));

module.exports = router;
