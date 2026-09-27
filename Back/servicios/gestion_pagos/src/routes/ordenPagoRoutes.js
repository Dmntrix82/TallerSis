// src/routes/ordenPagoRoutes.js
const { Router } = require("express");
const { recibirOrdenPago } = require("../services/ordenPagoService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-115 / TDSI-391: Endpoint para recibir la orden de pago
router.post("/compras/ordenes", wrap(async (req, res) => {
  const data = await recibirOrdenPago(req.body);
  res.status(201).json({ ok: true, data });
}));

module.exports = router;