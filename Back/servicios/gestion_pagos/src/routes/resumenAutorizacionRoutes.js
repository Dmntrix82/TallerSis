const { Router } = require("express");
const { obtenerResumenAutorizacion } = require("../services/resumenAutorizacionService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-195: vista previa de la factura para la ventana "Autorizacion de supervisor".
// GET /api/pagos/:id_transaccion/resumen-autorizacion
router.get("/:id_transaccion/resumen-autorizacion", wrap(async (req, res) => {
  const data = await obtenerResumenAutorizacion(req.params.id_transaccion);
  res.json({ ok: true, data });
}));

module.exports = router;
