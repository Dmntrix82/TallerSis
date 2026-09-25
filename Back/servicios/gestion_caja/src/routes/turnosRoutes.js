const { Router } = require("express");
const cierre = require("../services/cierreService");
const movimientoService = require("../services/movimientoService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

router.get("/turnos/:turnoId/recaudado", wrap(async (req, res) => {
  const data = await cierre.calcularTotalRecaudado(req.params.turnoId);
  res.json({ ok: true, data });
}));

router.post("/turnos/:turnoId/comparar-efectivo", wrap(async (req, res) => {
  const data = await cierre.compararEfectivo(req.params.turnoId, req.body.efectivoContado);
  res.json({ ok: true, data });
}));

router.get("/turnos/:turnoId/cierre/reporte", wrap(async (req, res) => {
  const efectivoContado = req.query.efectivoContado ? Number(req.query.efectivoContado) : null;
  const data = await cierre.generarReporteCierre(req.params.turnoId, efectivoContado);
  res.json({ ok: true, data });
}));

router.get("/turnos/:turnoId/cierre/reporte-texto", wrap(async (req, res) => {
  const efectivoContado = req.query.efectivoContado ? Number(req.query.efectivoContado) : null;
  const texto = await cierre.generarReporteTexto(req.params.turnoId, efectivoContado);
  res.type("text/plain").send(texto);
}));

router.post("/turnos/:turnoId/movimientos", wrap(async (req, res) => {
  const data = await movimientoService.registrarMovimiento(req.params.turnoId, req.body);
  res.status(201).json({ ok: true, data });
}));

router.post("/turnos/:turnoId/cerrar", wrap(async (req, res) => {
  const data = await cierre.cerrarTurno(req.params.turnoId, req.body.efectivoContado);
  res.json({ ok: true, mensaje: "Turno cerrado", data });
}));

module.exports = router;