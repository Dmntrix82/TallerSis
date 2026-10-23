const { Router } = require("express");
const { consultarEstadoCajas } = require("../services/cajaService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

/**
 * TDSI-24/125 + TDSI-465: consulta del estado de las cajas.
 *
 * GET /api/caja/estado
 * GET /api/caja/estado?estado=ABIERTA
 * GET /api/caja/estado?estado=CERRADA&activa=true
 * GET /api/caja/estado?activa=false
 */
router.get("/estado", wrap(async (req, res) => {
  const { estado, activa } = req.query;

  const filtros = {};
  if (estado !== undefined) filtros.estado = String(estado).trim().toUpperCase();
  if (activa !== undefined) filtros.activa = String(activa).trim().toLowerCase() === "true";

  const data = await consultarEstadoCajas(filtros);
  res.json({ ok: true, total: data.total, data: data.cajas });
}));

module.exports = router;