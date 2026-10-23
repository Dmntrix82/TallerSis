const { Router } = require("express");
const service = require("../services/aprobacionService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-35/147: operaciones que requieren aprobacion superior. Base: /api/caja/aprobaciones

// Catalogo de tipos de operacion (para el formulario y los filtros).
router.get("/tipos", wrap(async (req, res) => {
  res.json({ ok: true, data: service.listarTipos() });
}));

// TDSI-477: bandeja del supervisor. ?estado=PENDIENTE|APROBADA|RECHAZADA &tipo=... &caja_id=...
router.get("/", wrap(async (req, res) => {
  const r = await service.listar({ estado: req.query.estado, tipo: req.query.tipo, caja_id: req.query.caja_id });
  res.json({ ok: true, filtros: r.filtros, total: r.total, pendientes: r.pendientes, data: r.data });
}));

router.get("/:id", wrap(async (req, res) => {
  res.json({ ok: true, data: await service.obtener(req.params.id) });
}));

// TDSI-475: el cajero registra la operacion. Body: { turno_id, tipo, descripcion, monto?, solicitado_por, solicitado_por_nombre? }
router.post("/", wrap(async (req, res) => {
  res.status(201).json({ ok: true, mensaje: "Solicitud de aprobacion registrada", data: await service.solicitar(req.body) });
}));

// TDSI-476: el supervisor decide. Body: { supervisor_id, pin, motivo } (motivo obligatorio al rechazar)
router.post("/:id/aprobar", wrap(async (req, res) => {
  res.json({ ok: true, mensaje: "Operacion aprobada", data: await service.aprobar(req.params.id, req.body) });
}));

router.post("/:id/rechazar", wrap(async (req, res) => {
  res.json({ ok: true, mensaje: "Operacion rechazada", data: await service.rechazar(req.params.id, req.body) });
}));

module.exports = router;
