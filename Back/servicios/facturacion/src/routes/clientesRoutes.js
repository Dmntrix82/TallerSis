const { Router } = require("express");
const { buscarClientePorNit, sugerirClientes, guardarCliente } = require("../services/clientesService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

router.get("/:nit", wrap(async (req, res) => res.json({ ok: true, data: await buscarClientePorNit(req.params.nit) })));

router.get("/", wrap(async (req, res) => {
  const limite = Math.min(Number(req.query.limite) || 10, 50);
  const resultados = await sugerirClientes(req.query.q, limite);
  res.json({ ok: true, total: resultados.length, data: resultados });
}));

router.post("/", wrap(async (req, res) => res.status(201).json({ ok: true, mensaje: "Cliente guardado", data: await guardarCliente(req.body) })));

module.exports = router;