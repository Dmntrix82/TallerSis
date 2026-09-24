const { Router } = require("express");
const { registrarPagoSimple, obtenerHistorial } = require("../services/pagoSimpleService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

router.post("/registrar", wrap(async (req, res) => {
  const r = await registrarPagoSimple(req.body);
  res.status(200).json({
    mensaje: "Pago registrado exitosamente",
    pago: r.pago,
    totalTransacciones: r.totalTransacciones,
    clienteGuardado: r.clienteGuardado,
    cliente: r.cliente,
  });
}));

router.get("/historial", wrap(async (req, res) => {
  const r = await obtenerHistorial();
  res.status(200).json(r);
}));

module.exports = router;