const { Router } = require("express");
const { generarLote, consultarLote } = require("../services/loteCierreService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-418: genera el Lote de Cierre Diario de una fecha.
// Body: { "fecha": "YYYY-MM-DD", "generado_por": "usuario" }
// 201 lote creado | 400 datos invalidos | 409 la fecha ya tiene lote (detalle.lote) | 502 gestion_pagos no responde
router.post("/", wrap(async (req, res) => {
  const lote = await generarLote(req.body || {});
  res.status(201).json({ ok: true, mensaje: `Lote de cierre del ${lote.fecha} generado`, data: lote });
}));

// TDSI-418: consulta el lote de una fecha. 200 lote | 400 fecha invalida | 404 aun no hay lote
router.get("/:fecha", wrap(async (req, res) => {
  res.json({ ok: true, data: await consultarLote(req.params.fecha) });
}));

module.exports = router;