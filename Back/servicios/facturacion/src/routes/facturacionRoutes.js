const { Router } = require("express");
const facturasRepo = require("../data/facturasRepo");
const facturasService = require("../services/facturasService");
const tirilla = require("../services/tirillaService");
const impresion = require("../services/impresoraService");
const documentos = require("../services/documentosService");
const contabilidad = require("../services/contabilidadService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

router.get("/", wrap(async (req, res) => res.json({ ok: true, data: await facturasRepo.listarFacturas() })));

// TDSI-22: al emitir la factura se publica su mensaje 'venta' para Contabilidad (Grupo D).
// Si el envio falla la factura queda creada igual; el resultado va en "contabilidad".
router.post("/", wrap(async (req, res) => {
  const factura = await facturasService.crearFactura(req.body);
  const envio = await contabilidad.enviarFacturaSeguro(factura.id, "venta");
  res.status(201).json({ ok: true, mensaje: "Factura creada", data: factura, contabilidad: envio });
}));

// TDSI-22: envios de facturas a Contabilidad (antes de "/:numero" para que no lo tome como numero)
router.get("/envios-contabilidad", wrap(async (req, res) => {
  res.json({ ok: true, data: await contabilidad.listarEnvios(req.query) });
}));
router.post("/envios-contabilidad/:id/reenviar", wrap(async (req, res) => {
  const envio = await contabilidad.reenviarEnvio(req.params.id);
  const status = envio.estado === "Enviado" ? 200 : envio.estado === "Pendiente" ? 202 : 502;
  res.status(status).json({ ok: status !== 502, data: envio });
}));

router.get("/impresora", wrap((req, res) => res.json({ ok: true, data: impresion.estadoImpresora() })));
router.patch("/impresora", wrap((req, res) => res.json({ ok: true, data: impresion.conmutarImpresora(req.body.conectada) })));

router.get("/:numero", wrap(async (req, res) => res.json({ ok: true, data: await tirilla.obtenerFactura(req.params.numero) })));
router.get("/:numero/tirilla", wrap(async (req, res) => {
  const t = await tirilla.generarTirilla(req.params.numero, { copia: req.query.copia === "true" });
  res.type("text/plain").send(t.texto);
}));
router.post("/:numero/imprimir", wrap(async (req, res) => res.json({ ok: true, data: await impresion.imprimir(req.params.numero) })));
router.post("/:numero/reimprimir", wrap(async (req, res) => res.json({ ok: true, data: await impresion.reimprimir(req.params.numero, req.body && req.body.motivo) })));

// TDSI-22: envia a Contabilidad una factura ya existente (p. ej. emitida antes de configurar el topico).
// body: { tipo: "venta" | "anulacion" }. Si ya tiene ese envio, lo devuelve sin publicar de nuevo.
router.post("/:numero/enviar-contabilidad", wrap(async (req, res) => {
  const factura = await facturasRepo.obtenerFacturaCompleta(req.params.numero);
  if (!factura) return res.status(404).json({ ok: false, mensaje: "Factura no encontrada" });
  const envio = await contabilidad.enviarFactura(factura.id, (req.body && req.body.tipo) || "venta");
  res.json({ ok: true, data: envio });
}));

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