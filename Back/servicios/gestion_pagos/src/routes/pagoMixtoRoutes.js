const { Router } = require("express");
const mixto = require("../services/pagoMixtoService");

const router = Router();
const wrap = (fn) => (req, res, next) => { try { fn(req, res); } catch (e) { next(e); } };

router.post("/mixto/calcular", wrap((req, res) => res.json({ ok: true, data: mixto.calcularDivision(req.body) })));
router.post("/mixto", wrap((req, res) => res.status(201).json({ ok: true, mensaje: "Pago mixto registrado", data: mixto.registrarPagoMixto(req.body) })));
router.get("/mixto/:id_transaccion", wrap((req, res) => res.json({ ok: true, data: mixto.obtenerPorTransaccion(req.params.id_transaccion) })));

module.exports = router;