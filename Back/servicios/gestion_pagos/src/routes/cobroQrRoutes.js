const { Router } = require("express");
const { crearCobroPendiente, consultarEstadoCobro, confirmarPago } = require("../services/cobroQrService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-39/531: el cajero elige QR como metodo de pago -> se crea el cobro pendiente.
router.post("/qr", wrap(async (req, res) => {
  const { monto, caja_id, cajero } = req.body;
  const cobro = await crearCobroPendiente({ monto: Number(monto), caja_id, cajero });
  res.status(201).json(cobro);
}));

// TDSI-39/532: el frontend consulta periodicamente si ya se confirmo el pago.
router.get("/qr/:id/estado", wrap(async (req, res) => {
  const cobro = await consultarEstadoCobro(req.params.id);
  res.json(cobro);
}));

// TDSI-39/533: el cajero confirma a mano que vio llegar el deposito.
router.post("/qr/:id/confirmar", wrap(async (req, res) => {
  const cobro = await confirmarPago(req.params.id, { confirmado_por: req.body.confirmado_por });
  res.json(cobro);
}));

module.exports = router;
