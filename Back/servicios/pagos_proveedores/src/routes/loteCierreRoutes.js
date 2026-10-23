const { Router } = require("express");
const { generarLote, consultarLote } = require("../services/loteCierreService");
const { enviarLote, enviarLoteAutomatico } = require("../services/envioContabilidadService");
const { responderEnvio } = require("./respuestaEnvio");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-418/637: genera el Lote de Cierre Diario de una fecha.
// TDSI-122: y envia su reporte a Contabilidad automaticamente (resultado en "envio").
// Body: { "fecha": "YYYY-MM-DD", "generado_por": "usuario" }
// 201 lote creado | 400 datos invalidos | 409 la fecha ya tiene lote (detalle.lote)
// 422 periodo contable cerrado (detalle.codigo = PERIODO_CERRADO)
// 503 Contabilidad no responde (detalle.codigo = CONTABILIDAD_NO_DISPONIBLE) | 502 gestion_pagos no responde
router.post("/", wrap(async (req, res) => {
  const generado = await generarLote(req.body || {});
  const envio = await enviarLoteAutomatico(generado);
  const lote = envio.envio ? await consultarLote(generado.fecha) : generado; // el estado pudo pasar a ENVIADO
  res.status(201).json({ ok: true, mensaje: `Lote de cierre del ${lote.fecha} generado`, data: lote, envio });
}));

// TDSI-418: consulta el lote de una fecha. 200 lote | 400 fecha invalida | 404 aun no hay lote
router.get("/:fecha", wrap(async (req, res) => {
  res.json({ ok: true, data: await consultarLote(req.params.fecha) });
}));

// TDSI-122: envia (a mano) el reporte del lote de la fecha a Contabilidad.
// Body opcional: { "solicitado_por": "usuario" }
// 201 enviado | 202 pendiente (se reintenta solo) | 502 rechazado
// 404 no hay lote | 409 el lote ya tiene envio (detalle.codigo = ENVIO_EXISTENTE)
router.post("/:fecha/envio-contabilidad", wrap(async (req, res) => {
  responderEnvio(res, await enviarLote({ fecha: req.params.fecha, ...(req.body || {}) }), 201);
}));

module.exports = router;