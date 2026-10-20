const { Router } = require("express");
const { calcularVuelto, validarMontoRecibido } = require("../services/cobroEfectivoService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-29/549: el cajero ingresa cuanto le dio el cliente en efectivo y ve
// cuanto vuelto debe entregar, ANTES de confirmar el cobro.
router.post("/efectivo/calcular-vuelto", wrap(async (req, res) => {
  const total = Number(req.body.total);
  const montoRecibido = Number(req.body.monto_recibido);

  validarMontoRecibido(total, montoRecibido);
  const vuelto = calcularVuelto(total, montoRecibido);

  res.json({ ok: true, data: { total, monto_recibido: montoRecibido, vuelto } });
}));

module.exports = router;
