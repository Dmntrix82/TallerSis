const { Router } = require("express");
const { crearCobroPendiente } = require("../services/cobroQrService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-39/531: el cajero elige QR como metodo de pago -> se crea el cobro pendiente.
router.post("/qr", wrap(async (req, res) => {
  const { monto, caja_id, cajero } = req.body;
  const cobro = await crearCobroPendiente({ monto: Number(monto), caja_id, cajero });
  res.status(201).json(cobro);
}));

module.exports = router;
