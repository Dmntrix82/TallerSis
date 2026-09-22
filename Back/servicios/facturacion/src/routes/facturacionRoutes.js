const { Router } = require("express");
const { db } = require("../data/memoria");
const tirilla = require("../services/tirillaService");
const impresion = require("../services/impresoraService");

const router = Router();
const wrap = (fn) => (req, res) => {
  try { fn(req, res); }
  catch (e) { res.status(e.status || 400).json({ ok: false, mensaje: e.message }); }
};

router.get("/", (req, res) => res.json({ ok: true, data: db.facturas }));
router.get("/impresora", wrap((req, res) => res.json({ ok: true, data: impresion.estadoImpresora() })));
router.patch("/impresora", wrap((req, res) => res.json({ ok: true, data: impresion.conmutarImpresora(req.body.conectada) })));

router.get("/:numero", wrap((req, res) => res.json({ ok: true, data: tirilla.obtenerFactura(req.params.numero) })));
router.get("/:numero/tirilla", wrap((req, res) => {
  const t = tirilla.generarTirilla(req.params.numero, { copia: req.query.copia === "true" });
  res.type("text/plain").send(t.texto);
}));
router.post("/:numero/imprimir", wrap((req, res) => res.json({ ok: true, data: impresion.imprimir(req.params.numero) })));

module.exports = router;