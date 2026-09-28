const { Router } = require("express");
const { registrarPagoSimple, obtenerHistorial } = require("../services/pagoSimpleService");
const { enviarFacturaDeTransaccion } = require("../services/facturaDigitalService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// Extension de TDSI-107/108: el cajero pide enviar la factura digital al correo del
// cliente justo despues de pagar. No genera PDF/XML; construye los datos de la
// factura (sin items de producto, este proyecto aun no tiene catalogo) y los manda
// -- o simula el envio si todavia no hay credenciales SMTP configuradas.
router.post("/:id_transaccion/enviar-factura", wrap(async (req, res) => {
  const { factura, envio } = await enviarFacturaDeTransaccion(req.params.id_transaccion, req.body.email);
  const mensaje = envio.estado === "ENVIADO"
    ? "Factura enviada por correo."
    : envio.estado === "SIMULADO"
      ? "Factura generada. El envío por correo está simulado porque aún no hay credenciales SMTP configuradas."
      : "No se pudo enviar el correo, pero la factura se generó correctamente.";
  res.json({ ok: true, mensaje, data: { factura, envio } });
}));

router.post("/registrar", wrap(async (req, res) => {
  const r = await registrarPagoSimple(req.body);
  res.status(200).json({
    mensaje: "Pago registrado exitosamente",
    pago: r.pago,
    totalTransacciones: r.totalTransacciones,
    clienteGuardado: r.clienteGuardado,
    cliente: r.cliente,
  });
}));

router.get("/historial", wrap(async (req, res) => {
  const r = await obtenerHistorial();
  res.status(200).json(r);
}));

module.exports = router;