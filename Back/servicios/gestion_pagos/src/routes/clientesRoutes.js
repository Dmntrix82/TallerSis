const { Router } = require("express");
const {
  buscarClientePorNit,
  sugerirClientes,
  guardarCliente,
} = require("../services/clientesService");

const router = Router();

// Mismo helper que ya usan en pagoMixtoRoutes.js
const wrap = (fn) => (req, res, next) => {
  try {
    fn(req, res);
  } catch (e) {
    next(e);
  }
};

/**
 * TDSI-91 / TDSI-288
 * GET /api/clientes/:nit
 * Devuelve la Razón Social del cliente para autocompletado.
 */
router.get(
  "/:nit",
  wrap((req, res) => {
    const cliente = buscarClientePorNit(req.params.nit);
    res.json({ ok: true, data: cliente });
  })
);

/**
 * TDSI-290
 * GET /api/clientes?q=texto&limite=10
 * Sugerencias para autocompletado.
 */
router.get(
  "/",
  wrap((req, res) => {
    const limite = Math.min(Number(req.query.limite) || 10, 50);
    const resultados = sugerirClientes(req.query.q, limite);
    res.json({ ok: true, total: resultados.length, data: resultados });
  })
);

/**
 * TDSI-289 (futuro)
 * POST /api/clientes
 * Guarda un cliente si no existe.
 */
router.post(
  "/",
  wrap((req, res) => {
    const cliente = guardarCliente(req.body);
    res.status(201).json({ ok: true, mensaje: "Cliente guardado", data: cliente });
  })
);

module.exports = router;