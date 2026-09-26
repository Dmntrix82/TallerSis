const { Router } = require("express");
const facturasRepo = require("../data/facturasRepo");
const facturasService = require("../services/facturasService");
const tirilla = require("../services/tirillaService");
const impresion = require("../services/impresoraService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

router.get("/", wrap(async (req, res) => res.json({ ok: true, data: await facturasRepo.listarFacturas() })));

router.post("/", wrap(async (req, res) => res.status(201).json({ ok: true, mensaje: "Factura creada", data: await facturasService.crearFactura(req.body) })));

router.get("/impresora", wrap((req, res) => res.json({ ok: true, data: impresion.estadoImpresora() })));
router.patch("/impresora", wrap((req, res) => res.json({ ok: true, data: impresion.conmutarImpresora(req.body.conectada) })));

router.get("/:numero", wrap(async (req, res) => res.json({ ok: true, data: await tirilla.obtenerFactura(req.params.numero) })));
router.get("/:numero/tirilla", wrap(async (req, res) => {
  const t = await tirilla.generarTirilla(req.params.numero, { copia: req.query.copia === "true" });
  res.type("text/plain").send(t.texto);
}));
router.post("/:numero/imprimir", wrap(async (req, res) => res.json({ ok: true, data: await impresion.imprimir(req.params.numero) })));
router.post("/:numero/reimprimir", wrap(async (req, res) => res.json({ ok: true, data: await impresion.reimprimir(req.params.numero, req.body && req.body.motivo) })));

module.exports = router;