const { Router } = require("express");
const { registrarPagoSimple, obtenerHistorial, buscarClientePorDocumento } = require("../services/pagoSimpleService");
const { construirFacturaDigital, enviarFacturaDeTransaccion } = require("../services/facturaDigitalService");
const { generarFacturaPdfBuffer } = require("../services/facturaPdfService");
const { listarMisFacturas, anularVenta, reporteTurno, historialCliente, totalesGenerales, listarCajeros } = require("../services/ventasCajeroService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-303: PDF de la factura, en formato tirilla, listo para ver/imprimir desde el navegador.
router.get("/:id_transaccion/factura.pdf", wrap(async (req, res) => {
  const factura = await construirFacturaDigital(req.params.id_transaccion);
  const pdfBuffer = await generarFacturaPdfBuffer(factura);
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename="factura-${req.params.id_transaccion}.pdf"`,
  });
  res.send(pdfBuffer);
}));

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

// TDSI-304: autocompletar razon social si ese NIT/CI ya se uso en un pago anterior.
router.get("/cliente-por-documento", wrap(async (req, res) => {
  const r = await buscarClientePorDocumento(req.query.tipo_documento, req.query.numero);
  res.json({ ok: true, data: r });
}));

// TDSI-306/307: pantalla "Facturas" del cajero -- solo sus propias ventas,
// con filtro opcional de rango de fechas (?desde=YYYY-MM-DD&hasta=YYYY-MM-DD).
router.get("/mis-facturas", wrap(async (req, res) => {
  const r = await listarMisFacturas(req.query.cajero, { desde: req.query.desde, hasta: req.query.hasta });
  res.json({ ok: true, data: r });
}));

// TDSI-306: anular una venta propia (Simple o Mixta) con PIN de un supervisor de caja,
// dentro del plazo de 2 horas desde la emision.
router.post("/:id_transaccion/anular", wrap(async (req, res) => {
  const r = await anularVenta({ id_transaccion: req.params.id_transaccion, ...req.body });
  res.json({ ok: true, mensaje: `La venta ${req.params.id_transaccion} fue anulada.`, data: r });
}));

// TDSI-323: reporte de ventas de una caja (usado por gestion_caja para el cierre de turno).
router.get("/reporte-turno", wrap(async (req, res) => {
  const r = await reporteTurno({ caja_id: req.query.caja_id, desde: req.query.desde, hasta: req.query.hasta });
  res.json({ ok: true, data: r });
}));

// TDSI-329: lista de cajeros con al menos una venta, para la pantalla "Cajeros" del administrador.
router.get("/cajeros", wrap(async (req, res) => {
  const r = await listarCajeros();
  res.json({ ok: true, data: r });
}));

// TDSI-327: historial de compras de un cliente (NIT o CI), para el panel de administrador.
router.get("/historial-cliente", wrap(async (req, res) => {
  const r = await historialCliente(req.query.tipo_documento, req.query.numero);
  res.json({ ok: true, data: r });
}));

// TDSI-328: total ganado por el negocio desde el inicio (todas las cajas), para el tablero.
router.get("/totales-generales", wrap(async (req, res) => {
  const r = await totalesGenerales({ desde: req.query.desde, hasta: req.query.hasta });
  res.json({ ok: true, data: r });
}));

module.exports = router;