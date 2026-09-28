const { Router } = require("express");
const { consultarEstado, actualizarEstado, consultarHistorial } = require("../services/transaccionesEstadoService");
const { verificarToken } = require("../middlewares/verificarToken");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-359: consulta del estado (requiere token del Sistema Cliente)
router.get("/:id/estado", verificarToken, wrap(async (req, res) =>
  res.json({ ok: true, data: await consultarEstado(req.params.id) })
));

// TDSI-361: historial de cambios (requiere token)
router.get("/:id/historial", verificarToken, wrap(async (req, res) => {
  const historial = await consultarHistorial(req.params.id);
  res.json({ ok: true, total: historial.length, data: historial });
}));

// TDSI-360: actualizar el estado (uso INTERNO, no requiere token del Cliente)
router.patch("/:id/estado", wrap(async (req, res) =>
  res.json({ ok: true, mensaje: "Estado actualizado", data: await actualizarEstado(req.params.id, req.body) })
));

module.exports = router;