const { Router } = require("express");
const {
  calcularSubtotalItem,
  calcularSubtotalFactura,
  calcularImpuesto,
  calcularTotal,
  validarTotalesFactura,
} = require("../services/calculoFacturaService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-40/537: el cajero carga los items de la factura y el sistema calcula
// subtotal por item, IVA (13%) y total -- para no cometer errores a mano.
router.post("/calcular", wrap(async (req, res) => {
  const { items, descuento } = req.body;

  const itemsConSubtotal = (items || []).map((item) => ({
    ...item,
    subtotal: calcularSubtotalItem(item),
  }));
  const subtotal = calcularSubtotalFactura(items);
  const impuesto = calcularImpuesto(subtotal);
  const total = calcularTotal(subtotal, impuesto, descuento || 0);

  res.json({ items: itemsConSubtotal, subtotal, impuesto, descuento: descuento || 0, total });
}));

// TDSI-40/538: al emitir la factura, se revalida que los totales mostrados
// en pantalla sigan coincidiendo con lo que dan los items (por si el
// frontend quedo desincronizado o alguien manipulo el request).
router.post("/validar-totales", wrap(async (req, res) => {
  const { items, descuento, subtotal, impuesto, total } = req.body;
  const validado = validarTotalesFactura({ items, descuento, subtotal, impuesto, total });
  res.json({ ok: true, ...validado });
}));

module.exports = router;
