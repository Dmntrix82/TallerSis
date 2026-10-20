const { Router } = require("express");
const { AppError } = require("../utils/AppError");
const { generarReporte, reporteACsv } = require("../services/reporteCajaService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-36/149/494: GET /api/caja/reportes?caja_id=X&desde=YYYY-MM-DD&hasta=YYYY-MM-DD&formato=json|csv
router.get("/", wrap(async (req, res) => {
  const formato = String(req.query.formato || "json").toLowerCase();
  if (!["json", "csv"].includes(formato)) throw new AppError("El 'formato' debe ser json o csv", 400, { formato: req.query.formato });

  const reporte = await generarReporte({ caja_id: req.query.caja_id, desde: req.query.desde, hasta: req.query.hasta });
  if (formato === "csv") {
    res.set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reporte-${reporte.caja_id}-${reporte.desde}-a-${reporte.hasta}.csv"`,
    });
    return res.send(reporteACsv(reporte));
  }
  res.json({ ok: true, data: reporte });
}));

module.exports = router;
