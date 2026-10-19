const { Router } = require("express");
const { verificarToken } = require("../middlewares/verificarToken");
const { obtenerDocumentoDeFacturacion } = require("../services/facturaDocumentoProxy");
const { obtenerFacturaPorToken } = require("../services/verificacionFacturaService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

/** TDSI-108: el Sistema Cliente (autenticado) recibe como respuesta el PDF/XML de la factura */
router.get("/:numero/documentos/:tipo", verificarToken, wrap(async (req, res) => {
  const { buffer, contentType } = await obtenerDocumentoDeFacturacion(req.params.numero, req.params.tipo);
  res.setHeader("Content-Type", contentType);
  res.send(buffer);
}));

// TDSI-38/528: endpoint publico (sin login) al que lleva el QR impreso en la factura.
router.get("/verificar/:token", wrap(async (req, res) => {
  const data = await obtenerFacturaPorToken(req.params.token);
  res.json({ ok: true, data });
}));

module.exports = router;
