const { Router } = require("express");
const { autenticarCajero } = require("../services/authService");
const { validarCajaDisponible } = require("../services/cajaService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

router.post("/login", wrap(async (req, res) => {
  const cajero = await autenticarCajero(req.body);
  const caja = await validarCajaDisponible(req.body.caja_id);
  res.json({ ok: true, mensaje: "Login exitoso, terminal habilitado", data: { cajero, caja } });
}));

module.exports = router;
