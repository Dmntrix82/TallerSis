const PDFDocument = require("pdfkit");

const MARGEN = 50;
const ANCHO_UTIL = 595.28 - MARGEN * 2; // A4 en puntos, menos margenes

function linea(doc) {
  doc.moveDown(0.3);
  doc
    .moveTo(MARGEN, doc.y)
    .lineTo(MARGEN + ANCHO_UTIL, doc.y)
    .strokeColor("#cbd2d9")
    .stroke();
  doc.moveDown(0.5);
}

function fila(doc, izquierda, derecha, opciones = {}) {
  const y = doc.y;
  doc.font(opciones.negrita ? "Helvetica-Bold" : "Helvetica").fontSize(opciones.tamano || 10);
  doc.text(izquierda, MARGEN, y, { width: ANCHO_UTIL * 0.6 });
  const yTrasIzquierda = doc.y;
  doc.text(derecha, MARGEN + ANCHO_UTIL * 0.6, y, { width: ANCHO_UTIL * 0.4, align: "right" });
  doc.y = Math.max(doc.y, yTrasIzquierda);
  doc.moveDown(0.25);
}

function subtitulo(doc, texto) {
  doc.moveDown(0.5);
  doc.font("Helvetica-Bold").fontSize(12).fillColor("#345c32");
  doc.text(texto, MARGEN, doc.y, { width: ANCHO_UTIL });
  doc.fillColor("#000000");
  doc.moveDown(0.3);
}

const bs = (n) => `Bs. ${Number(n || 0).toFixed(2)}`;

/** TDSI-324: PDF del reporte de cierre de caja, con la firma del cajero al final. */
function generarReporteCierrePdfBuffer(reporte, { cajeroNombre, cajeroUsuario }) {
  const doc = new PDFDocument({ size: "A4", margin: MARGEN });

  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const listo = new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.font("Helvetica-Bold").fontSize(18).fillColor("#345c32");
  doc.text("TallerSis", { align: "center" });
  doc.fontSize(13).fillColor("#000000");
  doc.text("Reporte de Cierre de Caja", { align: "center" });
  doc.moveDown(1);

  fila(doc, "Turno:", reporte.codigo, { negrita: true });
  fila(doc, "Caja:", reporte.cajaId);
  fila(doc, "Cajero:", cajeroNombre || cajeroUsuario || "-");
  fila(doc, "Abierto:", new Date(reporte.abiertoEn).toLocaleString("es-BO"));
  fila(doc, "Cerrado:", reporte.cerradoEn ? new Date(reporte.cerradoEn).toLocaleString("es-BO") : "-");
  if (reporte.cerradoPorNombre) {
    fila(doc, "Cierre autorizado por:", reporte.cerradoPorNombre);
  }

  subtitulo(doc, "Ventas por método de pago");
  fila(doc, "Efectivo", `${bs(reporte.totalesPorMetodo.Efectivo.neto)}  (${reporte.totalesPorMetodo.Efectivo.operaciones} op.)`);
  fila(doc, "Tarjeta", `${bs(reporte.totalesPorMetodo.Tarjeta.neto)}  (${reporte.totalesPorMetodo.Tarjeta.operaciones} op.)`);
  fila(doc, "QR", `${bs(reporte.totalesPorMetodo.QR.neto)}  (${reporte.totalesPorMetodo.QR.operaciones} op.)`);
  linea(doc);
  fila(doc, "Total en digital (Tarjeta + QR)", bs(reporte.resumenVentas.totalDigital));
  fila(doc, "TOTAL RECAUDADO", bs(reporte.totalRecaudado), { negrita: true, tamano: 12 });

  subtitulo(doc, "Resumen de ventas");
  fila(doc, "Cantidad de ventas", String(reporte.resumenVentas.cantidadVentas));
  fila(doc, "Facturas anuladas", String(reporte.resumenVentas.cantidadAnuladas));
  if (reporte.resumenVentas.cantidadAnuladas > 0) {
    fila(doc, "Monto anulado (no contado)", bs(reporte.resumenVentas.montoAnulado));
  }

  if (reporte.arqueoEfectivo) {
    subtitulo(doc, "Arqueo de efectivo");
    fila(doc, "Efectivo inicial", bs(reporte.arqueoEfectivo.efectivoInicial));
    fila(doc, "Ventas en efectivo", bs(reporte.arqueoEfectivo.ventasEfectivo));
    fila(doc, "Egresos en efectivo", bs(reporte.arqueoEfectivo.egresosEfectivo));
    fila(doc, "Efectivo esperado", bs(reporte.arqueoEfectivo.efectivoEsperado), { negrita: true });
    fila(doc, "Efectivo contado", bs(reporte.arqueoEfectivo.efectivoContado), { negrita: true });

    const colorDif = reporte.arqueoEfectivo.tipoDiferencia === "CUADRA" ? "#065f46" : "#92400e";
    doc.fillColor(colorDif);
    fila(doc, reporte.arqueoEfectivo.tipoDiferencia, bs(reporte.arqueoEfectivo.diferencia), { negrita: true });
    doc.fillColor("#000000");
  }

  doc.moveDown(3);
  linea(doc);
  doc.moveDown(2.5);

  const anchoFirma = 220;
  const xFirma = MARGEN + (ANCHO_UTIL - anchoFirma) / 2;
  doc.moveTo(xFirma, doc.y).lineTo(xFirma + anchoFirma, doc.y).strokeColor("#000000").stroke();
  doc.moveDown(0.3);
  doc.font("Helvetica-Bold").fontSize(10).text("Firma del cajero", MARGEN, doc.y, { width: ANCHO_UTIL, align: "center" });
  doc.font("Helvetica").fontSize(9).fillColor("#616e7c");
  doc.text(cajeroNombre || cajeroUsuario || "-", { align: "center" });
  if (cajeroUsuario && cajeroUsuario !== cajeroNombre) {
    doc.text(cajeroUsuario, { align: "center" });
  }
  doc.fillColor("#000000");

  doc.end();
  return listo;
}

module.exports = { generarReporteCierrePdfBuffer };
