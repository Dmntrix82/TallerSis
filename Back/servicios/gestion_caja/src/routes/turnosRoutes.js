const { Router } = require("express");
const { abrirTurno, obtenerTurnoAbierto } = require("../services/turnosService");
const cierre = require("../services/cierreService");
const movimientoService = require("../services/movimientoService");
const { listarCajasActivas } = require("../services/cajaService");
const { generarReporteCierrePdfBuffer } = require("../services/reportePdfService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// Lista de cajas activas, para el selector de "Caja / terminal" en el login.
router.get("/cajas", wrap(async (req, res) => {
  res.json({ ok: true, data: await listarCajasActivas() });
}));

// TDSI-311/312: apertura de turno
router.post("/turnos/apertura", wrap(async (req, res) =>
  res.status(201).json({
    ok: true,
    mensaje: "Turno abierto correctamente",
    data: await abrirTurno(req.body),
  })
));

// Turno abierto de la caja del cajero logueado (para no pedirle el id a mano en el resumen de ventas)
router.get("/turnos/actual", wrap(async (req, res) => {
  const data = await obtenerTurnoAbierto(req.query.caja_id);
  res.json({ ok: true, data });
}));

// TDSI-319 a 322: cierre y reportes (viene de main)
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
  const data = await cierre.cerrarTurno(req.params.turnoId, {
    supervisor_id: req.body.supervisor_id,
    pin: req.body.pin,
  });
  res.json({ ok: true, mensaje: "Turno cerrado", data });
}));

// TDSI-324: PDF del reporte de cierre, con firma del cajero, para imprimir/guardar.
router.get("/turnos/:turnoId/cierre/pdf", wrap(async (req, res) => {
  const efectivoContado = req.query.efectivoContado ? Number(req.query.efectivoContado) : null;
  const reporte = await cierre.generarReporteCierre(req.params.turnoId, efectivoContado);
  const pdfBuffer = await generarReporteCierrePdfBuffer(reporte, { cajeroNombre: reporte.cajero, cajeroUsuario: reporte.cajero });
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename="cierre-${reporte.codigo}.pdf"`,
  });
  res.send(pdfBuffer);
}));

module.exports = router;