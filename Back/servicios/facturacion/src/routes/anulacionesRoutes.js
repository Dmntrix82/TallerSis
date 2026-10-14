const { Router } = require("express");
const { autorizarAnulacion, solicitarAnulacion, listarPendientes } = require("../services/anulacionesService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-539: lista de solicitudes en espera, para la pantalla del supervisor.
router.get("/pendientes", wrap(async (req, res) => {
  const data = await listarPendientes();
  res.json({ ok: true, data });
}));

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