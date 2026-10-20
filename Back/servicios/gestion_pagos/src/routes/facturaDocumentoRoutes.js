const { Router } = require("express");
const { verificarToken } = require("../middlewares/verificarToken");
const { obtenerDocumentoDeFacturacion } = require("../services/facturaDocumentoProxy");
const { modificarVenta, listarBitacoraModificaciones } = require("../services/ventasCajeroService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

/** TDSI-108: el Sistema Cliente (autenticado) recibe como respuesta el PDF/XML de la factura */
router.get("/:numero/documentos/:tipo", verificarToken, wrap(async (req, res) => {
  const { buffer, contentType } = await obtenerDocumentoDeFacturacion(req.params.numero, req.params.tipo);
  res.setHeader("Content-Type", contentType);
  res.send(buffer);
}));

// TDSI-37/545: el supervisor autoriza con su PIN corregir datos de una venta
// ya registrada (ej. NIT mal escrito), sin anularla ni cambiarle el numero.
router.put("/:numero/modificar", wrap(async (req, res) => {
  const data = await modificarVenta(req.params.numero, req.body);
  res.json({ ok: true, mensaje: "Venta modificada correctamente.", data });
}));

// TDSI-546: historial de modificaciones de esa venta (valor anterior y nuevo).
router.get("/:numero/bitacora", wrap(async (req, res) => {
  const data = await listarBitacoraModificaciones(req.params.numero);
  res.json({ ok: true, data });
}));

module.exports = router;
