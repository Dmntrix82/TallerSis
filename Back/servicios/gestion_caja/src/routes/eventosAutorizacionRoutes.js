const { Router } = require("express");
const { listarEventos } = require("../services/eventosAutorizacionService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-62/963/964: apertura, cierre y aprobacion de operaciones especiales, para que
// el Front los combine con el historial de ventas/anulaciones de gestion_pagos en
// "Historial de operaciones". ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&supervisor_id=...
router.get("/", wrap(async (req, res) => {
  const data = await listarEventos(req.query);
  res.set("Cache-Control", "no-store");
  res.json({ ok: true, data });
}));

module.exports = router;
