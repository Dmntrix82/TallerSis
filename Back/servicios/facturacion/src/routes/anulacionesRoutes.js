const { Router } = require("express");
const { autorizarAnulacion, solicitarAnulacion } = require("../services/anulacionesService");
const { enviarFacturaSeguro } = require("../services/contabilidadService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

router.post("/", wrap(async (req, res) => {
  const data = await solicitarAnulacion(req.body);
  res.status(201).json({ ok: true, mensaje: "Anulación solicitada", data });
}));

router.post("/:id/autorizar", wrap(async (req, res) => {
  const data = await autorizarAnulacion(req.params.id, req.body);
  const aprobada = data.estado === "Autorizada";
  const mensaje = aprobada ? "Anulación aprobada: la factura quedó Anulada" : "Anulación rechazada";
  // TDSI-22: la anulacion aprobada se publica para Contabilidad (envio 'anulacion')
  const contabilidad = aprobada ? await enviarFacturaSeguro(data.factura_id, "anulacion") : null;
  res.json({ ok: true, mensaje, data, contabilidad });
}));

module.exports = router;