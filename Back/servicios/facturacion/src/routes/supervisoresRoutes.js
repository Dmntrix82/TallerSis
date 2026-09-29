const { Router } = require("express");
const { validarPin } = require("../services/pinService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// Validacion generica del codigo (usuario + PIN) de un supervisor de caja.
// La usa tanto la autorizacion de anulaciones (aca mismo) como la apertura de
// turno en gestion_caja (via HTTP, ver supervisorProxy.js), para no duplicar
// el registro de supervisores en dos schemas distintos.
router.post("/validar", wrap(async (req, res) => {
  const supervisor = await validarPin(req.body.supervisor_id, req.body.pin);
  res.json({ ok: true, data: supervisor });
}));

module.exports = router;
