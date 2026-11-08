const { Router } = require("express");
const {
  calcularVuelto,
  validarMontoRecibido,
  calcularDesgloseVuelto,
  calcularCobroUsd
} = require("../services/cobroEfectivoService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-29/549/786: el cajero ingresa cuanto le dio el cliente en efectivo y ve
// cuanto vuelto debe entregar y el desglose sugerido, ANTES de confirmar el cobro.
router.post("/efectivo/calcular-vuelto", wrap(async (req, res) => {
  const total = Number(req.body.total);
  const montoRecibido = Number(req.body.monto_recibido);

  validarMontoRecibido(total, montoRecibido);
  
  const vuelto = calcularVuelto(total, montoRecibido);
  const desglose = calcularDesgloseVuelto(vuelto); 

  res.json({ 
    ok: true, 
    data: { 
      total, 
      monto_recibido: montoRecibido, 
      vuelto, 
      desglose 
    } 
  });
}));
// TDSI-812: Calcula el vuelto cuando el pago es en dólares (el sistema convierte a Bs y da el vuelto en Bs).
router.post("/efectivo-usd/calcular-vuelto", wrap(async (req, res) => {
  const data = await calcularCobroUsd({
    total: Number(req.body.total),
    dolaresRecibidos: Number(req.body.dolares_recibidos),
  });
  res.json({ ok: true, data });
}));

module.exports = router;