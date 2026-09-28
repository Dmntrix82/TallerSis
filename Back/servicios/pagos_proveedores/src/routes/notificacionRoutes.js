const { Router } = require("express");
const { listarNotificaciones, marcarNotificacionLeida } = require("../services/notificacionService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-394: notificaciones no leidas del administrador (?incluirLeidas=true para ver todas)
router.get("/", wrap(async (req, res) => {
  const data = await listarNotificaciones({ incluirLeidas: req.query.incluirLeidas });
  res.json({ ok: true, data });
}));

// TDSI-394: marcar una notificacion como leida
router.patch("/:id/leida", wrap(async (req, res) => {
  const data = await marcarNotificacionLeida(req.params.id);
  res.json({ ok: true, data });
}));

module.exports = router;
