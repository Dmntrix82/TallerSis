const { Router } = require("express");
const { crearCajero, listarUsuarios, editarUsuario, cambiarPasswordCajero } = require("../services/adminUsuariosService");

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

// TDSI-47/917: "Editar" -- cambia nombre y usuario de un cajero o un supervisor.
router.put("/:id", wrap(async (req, res) => {
  const usuario = await editarUsuario(req.params.id, req.body);
  res.json({ ok: true, data: usuario });
}));

// TDSI-47/917: "Cambiar contrasena" -- solo para cajeros.
router.put("/cajeros/:id/password", wrap(async (req, res) => {
  const cajero = await cambiarPasswordCajero(req.params.id, req.body);
  res.json({ ok: true, mensaje: "Contrasena actualizada.", data: cajero });
}));

module.exports = router;
