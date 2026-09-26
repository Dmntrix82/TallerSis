const { Router } = require("express");
const { registrarEgreso, obtenerHistorial } = require("../services/egresoService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

router.post("/", wrap(async (req, res) => {
  const resultado = await registrarEgreso(req.body);
  res.status(201).json({ ok: true, mensaje: "Egreso registrado y orden liquidada", data: resultado });
}));

router.get("/", wrap(async (req, res) => {
  const resultado = await obtenerHistorial();
  res.json({ ok: true, data: resultado });
}));

module.exports = router;
