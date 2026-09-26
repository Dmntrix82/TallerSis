const { Router } = require("express");
const { confirmarPago, consultarConfirmacion } = require("../services/confirmacionPagoService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

router.post("/:id/confirmar-pago", wrap(async (req, res) => {
  const r = await confirmarPago(req.params.id, req.body);

  if (r.enviada)
    return res.json({ ok: true, mensaje: "Pago confirmado a Compras", data: r.orden });

  if (r.estado === "PENDIENTE")
    return res.status(202).json({
      ok: true,
      mensaje: "Compras no respondió. La confirmación se reintentará automáticamente",
      data: r,
    });

  return res.status(502).json({ ok: false, mensaje: "Compras rechazó la confirmación", data: r });
}));

router.get("/:id/confirmacion", wrap(async (req, res) =>
  res.json({ ok: true, data: await consultarConfirmacion(req.params.id) })
));

module.exports = router;