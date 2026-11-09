const { Router } = require("express");
const service = require("../services/operacionEspecialService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-62: catalogo de tipos de operacion, para el selector del formulario.
router.get("/tipos", wrap(async (req, res) => {
  res.json({ ok: true, data: service.listarTipos() });
}));

// TDSI-62/957: historial. ?tipo=...&caja_id=...&supervisor_id=...
router.get("/", wrap(async (req, res) => {
  const r = await service.listar({ tipo: req.query.tipo, caja_id: req.query.caja_id, supervisor_id: req.query.supervisor_id });
  res.json({ ok: true, filtros: r.filtros, total: r.total, data: r.data });
}));

router.get("/:id", wrap(async (req, res) => {
  res.json({ ok: true, data: await service.obtener(req.params.id) });
}));

// TDSI-62/201/955: el cajero pide la operacion y el supervisor la autoriza en
// el momento con usuario + PIN. Body: { turno_id, tipo, descripcion, monto?,
// cajero_id, cajero_nombre?, supervisor_id, pin }
router.post("/", wrap(async (req, res) => {
  res.status(201).json({ ok: true, mensaje: "Operacion autorizada y registrada", data: await service.registrar(req.body) });
}));

module.exports = router;
