const { Router } = require("express");
const { abrirTurno } = require("../services/turnosService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

router.post("/apertura", wrap(async (req, res) =>
  res.status(201).json({ ok: true, mensaje: "Turno abierto correctamente", data: await abrirTurno(req.body) })
));

module.exports = router;