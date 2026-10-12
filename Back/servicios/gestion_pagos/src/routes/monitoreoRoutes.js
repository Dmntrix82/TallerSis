const { Router } = require("express");
const { obtenerMonitoreo } = require("../services/monitoreoService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-426/123: monitoreo de operaciones de cajeros (panel del Supervisor de Caja).
// GET /api/pagos/monitoreo?caja_id=CAJA-01&cajero_id=ana@x.bo&fecha=YYYY-MM-DD&limite=5
//   todos los filtros son opcionales; fecha por defecto = hoy (hora de Bolivia), limite 1..20 (5)
// 200 { fecha, filtros, actualizado_en, totales, cajeros: [{ resumen..., ultima_operacion, operaciones }] }
//     (cajeros: [] = "sin operaciones")
// 400 filtro invalido
router.get("/", wrap(async (req, res) => {
  const { caja_id, cajero_id, fecha, limite } = req.query;
  // El panel lo consulta cada pocos segundos: nunca debe responder algo guardado en cache.
  res.set("Cache-Control", "no-store");
  res.json({ ok: true, data: await obtenerMonitoreo({ caja_id, cajero_id, fecha, limite }) });
}));

module.exports = router;