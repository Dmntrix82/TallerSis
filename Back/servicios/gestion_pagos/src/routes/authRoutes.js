const { Router } = require("express");
const { generarToken } = require("../services/authService");
const { verificarToken } = require("../middlewares/verificarToken");

const router = Router();
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res)).catch(next);

// TDSI-335: endpoint que entrega el token de acceso
router.post(
  "/token",
  wrap(async (req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({
      ok: true,
      mensaje: "Token generado",
      data: await generarToken(req.body),
    });
  })
);

// Ruta protegida para comprobar que el token funciona
router.get("/verificar", verificarToken, (req, res) =>
  res.json({
    ok: true,
    mensaje: "Token válido",
    data: req.sistemaCliente,
  })
);

module.exports = router;