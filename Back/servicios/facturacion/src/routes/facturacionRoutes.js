const { Router } = require("express");
const facturasRepo = require("../data/facturasRepo");
const facturasService = require("../services/facturasService");
const tirilla = require("../services/tirillaService");
const impresion = require("../services/impresoraService");
const documentos = require("../services/documentosService");

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

// TDSI-356: estado de generacion de los documentos (PDF/XML) de una factura
router.get("/:numero/documentos", wrap(async (req, res) => {
  res.json({ ok: true, data: await documentos.obtenerEstadoDocumentos(req.params.numero) });
}));

// TDSI-353: entrega al Sistema Cliente el PDF/XML ya generado de la factura
router.get("/:numero/documentos/:tipo", wrap(async (req, res) => {
  const { archivo, contentType, nombreArchivo } = await documentos.obtenerArchivoParaEntrega(req.params.numero, req.params.tipo);
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${nombreArchivo}"`);
  res.send(archivo);
}));

module.exports = router;