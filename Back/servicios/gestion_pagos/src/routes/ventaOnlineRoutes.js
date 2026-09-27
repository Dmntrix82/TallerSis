const { Router } = require("express");
const { recibirVenta } = require("../services/ventaOnlineService");
const { anularPagoOnline } = require("../services/anulacionService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-105: Endpoint de venta online
router.post("/online", wrap(async (req, res) => {
  const data = await recibirVenta(req.body);
  res.status(201).json({ ok: true, data });
}));

// TDSI-110 / TDSI-367: Endpoint de solicitud de anulación
router.post("/online/anular", wrap(async (req, res) => {
  const data = await anularPagoOnline(req.body);
  res.json({ ok: true, mensaje: "Solicitud procesada", data });
}));

module.exports = router;