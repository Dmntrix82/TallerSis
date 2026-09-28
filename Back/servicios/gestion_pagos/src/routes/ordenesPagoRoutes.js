const { Router } = require("express");
const { recibirOrdenPago, listarOrdenesPendientes } = require("../services/ordenesPagoService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-115 / TDSI-391: Endpoint que recibe las órdenes de pago de Compras
router.post("/compras/recepcion", wrap(async (req, res) => {
  const data = await recibirOrdenPago(req.body);
  res.status(201).json({ ok: true, ...data });
}));

// TDSI-116: Listar órdenes pendientes para la bandeja
router.get("/pendientes", wrap(async (req, res) => {
  const ordenes = await listarOrdenesPendientes();
  res.json({ ok: true, data: ordenes });
}));

module.exports = router;
