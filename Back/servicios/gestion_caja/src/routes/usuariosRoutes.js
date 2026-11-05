const { Router } = require("express");
const { crearCajero, listarUsuarios } = require("../services/adminUsuariosService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-47/916: lista de cajeros y supervisores para la pantalla "Usuarios".
router.get("/", wrap(async (req, res) => {
  const data = await listarUsuarios();
  res.json({ ok: true, data });
}));

// TDSI-47/171: el Administrador registra un cajero nuevo (usuario/contrasena).
router.post("/cajeros", wrap(async (req, res) => {
  const cajero = await crearCajero(req.body);
  res.status(201).json({ ok: true, mensaje: "Cajero registrado.", data: cajero });
}));

module.exports = router;
