const { Router } = require("express");
const { consultarHistorial } = require("../services/historialCajerosService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-33/434: historial de operaciones de cajeros (Supervisor de Caja).
// GET /api/pagos/historial-cajeros
//   Rango:  ?fecha=YYYY-MM-DD  o  ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
//           (sin fechas = ultimos 7 dias hasta hoy, hora de Bolivia; maximo 92 dias)
//   Filtros opcionales: cajero_id, caja_id, metodo=Efectivo|Tarjeta|QR,
//                       estado_revision=PENDIENTE|REVISADA|OBSERVADA
//   Paginacion: pagina=1, por_pagina=20 (maximo 100)
// 200 { filtros, paginacion, resumen: { ..., por_cajero, por_dia }, operaciones: [...] }
// 400 si algun filtro es invalido.
router.get("/", wrap(async (req, res) => {
  const { fecha, desde, hasta, cajero_id, caja_id, metodo, estado_revision, pagina, por_pagina } = req.query;
  const data = await consultarHistorial({ fecha, desde, hasta, cajero_id, caja_id, metodo, estado_revision, pagina, por_pagina });
  res.set("Cache-Control", "no-store"); // el historial cambia con cada venta o revision
  res.json({ ok: true, data });
}));

module.exports = router;