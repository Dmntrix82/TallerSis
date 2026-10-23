const { Router } = require("express");
const { monitorearMetodos } = require("../services/metodosPagoService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-34/438: monitoreo por metodo de pago (Supervisor de Caja).
// GET /api/pagos/metodos
//   Rango:  ?fecha=YYYY-MM-DD  o  ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
//           (sin fechas = hoy, hora de Bolivia; maximo 92 dias)
//   Filtros opcionales: caja_id, cajero_id
// 200 { filtros, cantidad_operaciones, monto_total,
//       metodos: [{ metodo, cantidad, monto, porcentaje, simples: {cantidad, monto}, mixtos: {cantidad, monto} }],
//       pagos_mixtos: { cantidad, monto, combinaciones: [{ metodos, cantidad, monto }] } }
// 400 si algun filtro es invalido.
router.get("/", wrap(async (req, res) => {
  const { fecha, desde, hasta, caja_id, cajero_id } = req.query;
  const data = await monitorearMetodos({ fecha, desde, hasta, caja_id, cajero_id });
  res.set("Cache-Control", "no-store"); // cambia con cada venta
  res.json({ ok: true, data });
}));

module.exports = router;