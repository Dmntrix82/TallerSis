const { Router } = require("express");
const { autorizarAnulacion, solicitarAnulacion } = require("../services/anulacionesService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

router.post("/", wrap(async (req, res) => {
  const data = await solicitarAnulacion(req.body);
  res.status(201).json({ ok: true, mensaje: "Anulación solicitada", data });
}));

router.post("/:id/autorizar", wrap(async (req, res) => {
  const data = await autorizarAnulacion(req.params.id, req.body);
  const mensaje = data.estado === "Autorizada"
    ? "Anulación aprobada: la factura quedó Anulada"
    : "Anulación rechazada";
  res.json({ ok: true, mensaje, data });
}));

module.exports = router;