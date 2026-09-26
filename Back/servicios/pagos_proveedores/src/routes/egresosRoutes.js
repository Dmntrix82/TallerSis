const { Router } = require("express");
const { registrarEgreso } = require("../services/egresoService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

router.post("/", wrap(async (req, res) => {
  const resultado = await registrarEgreso(req.body);
  res.status(201).json({ ok: true, mensaje: "Egreso registrado y orden liquidada", data: resultado });
}));

module.exports = router;
