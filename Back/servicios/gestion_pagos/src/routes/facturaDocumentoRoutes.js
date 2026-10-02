const { Router } = require("express");
const { verificarToken } = require("../middlewares/verificarToken");
const { obtenerDocumentoDeFacturacion } = require("../services/facturaDocumentoProxy");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

/** TDSI-108: el Sistema Cliente (autenticado) recibe como respuesta el PDF/XML de la factura */
router.get("/:numero/documentos/:tipo", verificarToken, wrap(async (req, res) => {
  const { buffer, contentType } = await obtenerDocumentoDeFacturacion(req.params.numero, req.params.tipo);
  res.setHeader("Content-Type", contentType);
  res.send(buffer);
}));

module.exports = router;
