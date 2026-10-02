const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const { montoEnLetras } = require("../utils/numeroALetras");

// TDSI-303: comprobante en formato de tirilla (ancho angosto, como una impresora
// termica de 80mm) para poder imprimirlo al momento o adjuntarlo en el correo.
const ANCHO_PT = 227; // ~80mm
const MARGEN = 14;
const ANCHO_QR = 80;

function formatearFechaHora(fechaIso) {
  const fecha = new Date(fechaIso);
  const dia = fecha.toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "numeric" });
  const hora = fecha.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  return { dia, hora };
}

function centrado(doc, texto, opciones = {}) {
  doc.text(texto, MARGEN, doc.y, { width: ANCHO_PT - MARGEN * 2, align: "center", ...opciones });
}

function lineaPunteada(doc) {
  doc.moveDown(0.2);
  doc
    .save()
    .dash(1, { space: 1.5 })
    .moveTo(MARGEN, doc.y)
    .lineTo(ANCHO_PT - MARGEN, doc.y)
    .strokeColor("#666666")
    .stroke()
    .restore();
  doc.moveDown(0.3);
}

function filaDosColumnas(doc, izquierda, derecha, opcionesTexto = {}) {
  const anchoDisponible = ANCHO_PT - MARGEN * 2;
  const y = doc.y;
  doc.text(izquierda, MARGEN, y, { width: anchoDisponible * 0.55, ...opcionesTexto });
  const yTrasIzquierda = doc.y;
  doc.text(derecha, MARGEN + anchoDisponible * 0.55, y, { width: anchoDisponible * 0.45, align: "right", ...opcionesTexto });
  doc.y = Math.max(doc.y, yTrasIzquierda);
  doc.moveDown(0.15);
}

/** Dibuja todo el contenido del comprobante sobre `doc`, desde el borde superior de la pagina. */
function dibujarContenido(doc, { factura, dia, hora, qrBuffer }) {
  doc.moveDown(0.6);
  doc.font("Helvetica-Bold").fontSize(12);
  centrado(doc, factura.empresa.nombre);
  doc.font("Helvetica").fontSize(8);
  doc.moveDown(0.2);
  centrado(doc, factura.empresa.direccion);
  centrado(doc, `NIT: ${factura.empresa.nit}`);
  if (factura.comprobante.caja_id) {
    centrado(doc, `Punto de venta: ${factura.comprobante.caja_id}`);
  }

  doc.moveDown(0.4);
  doc.font("Helvetica-Bold").fontSize(9);
  centrado(doc, factura.comprobante.tipo_pago === "Mixto" ? "COMPROBANTE DE PAGO MIXTO" : "COMPROBANTE DE PAGO");

  if (factura.comprobante.anulada) {
    doc.moveDown(0.2);
    doc.fillColor("#b91c1c").fontSize(11);
    centrado(doc, "*** ANULADA ***");
    doc.fillColor("#000000");
  }

  doc.font("Helvetica").fontSize(8);
  lineaPunteada(doc);

  doc.font("Helvetica").fontSize(8);
  filaDosColumnas(doc, "N° de comprobante:", factura.comprobante.id_transaccion);
  filaDosColumnas(doc, "Fecha:", dia);
  filaDosColumnas(doc, "Hora de emisión:", hora);
  if (factura.comprobante.cajero) {
    filaDosColumnas(doc, "Emitido por (cajero):", factura.comprobante.cajero);
  }
  if (factura.comprobante.caja_id) {
    filaDosColumnas(doc, "Caja:", factura.comprobante.caja_id);
  }

  lineaPunteada(doc);
  filaDosColumnas(doc, "Nombre/Razón social:", factura.cliente.razon_social);
  if (factura.cliente.nit) {
    filaDosColumnas(doc, "NIT/CI:", factura.cliente.nit);
  }

  lineaPunteada(doc);
  doc.font("Helvetica-Bold").fontSize(8);
  filaDosColumnas(doc, "Método de pago", "Monto Bs.");
  doc.font("Helvetica").fontSize(8);
  factura.pagos.forEach((p) => {
    filaDosColumnas(doc, p.metodo, p.monto.toFixed(2));
  });

  lineaPunteada(doc);
  doc.font("Helvetica-Bold").fontSize(10);
  filaDosColumnas(doc, "TOTAL Bs.", factura.total.toFixed(2));

  doc.font("Helvetica").fontSize(7.5);
  doc.moveDown(0.3);
  doc.text(`Son: ${montoEnLetras(factura.total)}`, MARGEN, doc.y, { width: ANCHO_PT - MARGEN * 2 });

  lineaPunteada(doc);
  const yQr = doc.y;
  doc.image(qrBuffer, ANCHO_PT / 2 - ANCHO_QR / 2, yQr, { width: ANCHO_QR, height: ANCHO_QR });
  doc.y = yQr + ANCHO_QR + 6; // doc.image no mueve el cursor solo: hay que avanzarlo a mano.

  doc.fontSize(6.5).fillColor("#444444");
  centrado(doc, `Código de verificación: ${factura.comprobante.codigoVerificacion.slice(0, 16)}`);
  doc.moveDown(0.4);
  centrado(doc, "Documento generado por el sistema TallerSis.");
  centrado(doc, "Uso académico - Taller de Sistemas de Información.");
  doc.moveDown(0.3);
  doc.fillColor("#000000").fontSize(8);
  centrado(doc, "¡Gracias por su compra!");
  doc.moveDown(0.6);
}

/** Genera el PDF de la factura/comprobante como Buffer, listo para adjuntar en un correo o servir para imprimir. */
async function generarFacturaPdfBuffer(factura) {
  const { dia, hora } = formatearFechaHora(factura.comprobante.fecha);
  const qrDataUrl = await QRCode.toDataURL(
    `${factura.comprobante.id_transaccion}|${factura.total.toFixed(2)}|${factura.comprobante.codigoVerificacion}`,
    { margin: 0, width: ANCHO_QR * 2 }
  );
  const qrBuffer = Buffer.from(qrDataUrl.split(",")[1], "base64");
  const contexto = { factura, dia, hora, qrBuffer };

  // La altura de la tirilla depende de cuantos metodos de pago tenga la venta, asi que
  // primero se "dibuja" en un documento descartable de sobra para medir cuanto ocupa,
  // y recien despues se genera el PDF real con el alto exacto (sin espacio en blanco).
  const docMedida = new PDFDocument({ size: [ANCHO_PT, 2000], margin: 0 });
  docMedida.on("data", () => {});
  dibujarContenido(docMedida, contexto);
  const alturaTotal = Math.ceil(docMedida.y) + 10;
  docMedida.end();

  const doc = new PDFDocument({ size: [ANCHO_PT, alturaTotal], margin: 0 });
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const listo = new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  dibujarContenido(doc, contexto);
  doc.end();
  return listo;
}

module.exports = { generarFacturaPdfBuffer };
