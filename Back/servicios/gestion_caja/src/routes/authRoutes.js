const { Router } = require("express");
const { autenticarCajero } = require("../services/authService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

router.post("/login", wrap(async (req, res) => {
  const resultado = await autenticarCajero(req.body);
  res.json({ ok: true, mensaje: "Login exitoso", data: resultado });
}));

module.exports = router;
