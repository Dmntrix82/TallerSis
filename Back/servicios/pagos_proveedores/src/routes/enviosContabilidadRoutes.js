const { Router } = require("express");
const { listarEnvios, obtenerEnvio, reenviarEnvio } = require("../services/envioContabilidadService");
const { responderEnvio } = require("./respuestaEnvio");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-122/443/576: lista de envios. Query opcional: ?estado=PENDIENTE|ENVIADO|ERROR&limite=50
// 200 { total, envios } (total 0 = "sin envios") | 400 filtro invalido
router.get("/", wrap(async (req, res) => {
  res.json({ ok: true, data: await listarEnvios({ estado: req.query.estado, limite: req.query.limite }) });
}));

// TDSI-122: detalle de un envio con el reporte enviado. 200 | 400 id invalido | 404 no existe
router.get("/:id", wrap(async (req, res) => {
  res.json({ ok: true, data: await obtenerEnvio(req.params.id) });
}));

// TDSI-122/445/601: reenviar un envio en ERROR. Body opcional: { "solicitado_por": "usuario" }
// 200 enviado | 202 pendiente (se reintenta solo) | 502 volvio a fallar
// 404 no existe | 409 no esta en ERROR (detalle.codigo = ENVIO_NO_REENVIABLE)
router.post("/:id/reenviar", wrap(async (req, res) => {
  responderEnvio(res, await reenviarEnvio(req.params.id, req.body || {}));
}));

module.exports = router;