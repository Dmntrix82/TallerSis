const { Router } = require("express");
const service = require("../services/autorizacionService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-467: el cajero solicita apertura
router.post("/solicitar-apertura", wrap(async (req, res) =>
  res.status(201).json({
    ok: true,
    mensaje: "Solicitud de apertura registrada",
    data: await service.solicitarApertura(req.body),
  })
));

// TDSI-582: bandeja del supervisor
router.get("/pendientes", wrap(async (req, res) => {
  const data = await service.listarPendientes();
  res.json({ ok: true, total: data.length, data });
}));

// TDSI-468/605: aprobar
router.post("/:id/aprobar", wrap(async (req, res) =>
  res.json({
    ok: true,
    mensaje: "Solicitud aprobada y turno abierto",
    data: await service.aprobarSolicitud(req.params.id, req.body),
  })
));

// TDSI-468/604: rechazar
router.post("/:id/rechazar", wrap(async (req, res) =>
  res.json({
    ok: true,
    mensaje: "Solicitud rechazada",
    data: await service.rechazarSolicitud(req.params.id, req.body),
  })
));

module.exports = router;