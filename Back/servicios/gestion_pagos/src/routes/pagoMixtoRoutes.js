const { Router } = require("express");
const mixto = require("../services/pagoMixtoService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

router.post("/mixto/calcular", wrap(async (req, res) => res.json({ ok: true, data: mixto.calcularDivision(req.body) })));
router.post("/mixto", wrap(async (req, res) => res.status(201).json({ ok: true, mensaje: "Pago mixto registrado", data: await mixto.registrarPagoMixto(req.body) })));
router.get("/mixto/:id_transaccion", wrap(async (req, res) => res.json({ ok: true, data: await mixto.obtenerPorTransaccion(req.params.id_transaccion) })));

module.exports = router;