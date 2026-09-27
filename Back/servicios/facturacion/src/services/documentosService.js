const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const facturasRepo = require("../data/facturasRepo");
const documentosRepo = require("../data/documentosRepo");

const CARPETA_STORAGE = path.join(__dirname, "..", "..", "storage", "facturas");
const TIPOS_VALIDOS = ["pdf", "xml"];
const CONTENT_TYPES = { pdf: "application/pdf", xml: "application/xml" };

function generarPdfBuffer(factura) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text(`FACTURA ${factura.numero}`, { align: "center" });
    doc.moveDown();
    doc.fontSize(10);
    doc.text(`Fecha: ${new Date(factura.fecha).toLocaleString("es-BO")}`);
    doc.text(`Cliente: ${factura.cliente_nombre || "-"}`);
    doc.text(`NIT/CI: ${factura.cliente_nit || "-"}`);
    doc.moveDown();

    doc.text(
      "Descripcion".padEnd(30) + "Cant.".padStart(6) + "P.Unit".padStart(10) + "Subtotal".padStart(10)
    );
    doc.moveDown(0.5);
    for (const it of factura.items) {
      doc.text(
        String(it.descripcion).slice(0, 30).padEnd(30) +
        String(it.cantidad).padStart(6) +
        Number(it.precio_unitario).toFixed(2).padStart(10) +
        Number(it.subtotal).toFixed(2).padStart(10)
      );
    }
    doc.moveDown();
    doc.text(`Subtotal: ${Number(factura.subtotal).toFixed(2)}`, { align: "right" });
    if (Number(factura.descuento) > 0) {
      doc.text(`Descuento: -${Number(factura.descuento).toFixed(2)}`, { align: "right" });
    }
    doc.text(`IVA: ${Number(factura.impuesto).toFixed(2)}`, { align: "right" });
    doc.fontSize(12).text(`TOTAL Bs: ${Number(factura.total).toFixed(2)}`, { align: "right" });

    doc.end();
  });
}

function escapeXml(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function generarXml(factura) {
  const items = factura.items
    .map(
      (it) => `
    <item>
      <descripcion>${escapeXml(it.descripcion)}</descripcion>
      <cantidad>${it.cantidad}</cantidad>
      <precioUnitario>${Number(it.precio_unitario).toFixed(2)}</precioUnitario>
      <subtotal>${Number(it.subtotal).toFixed(2)}</subtotal>
    </item>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<factura numero="${escapeXml(factura.numero)}">
  <fecha>${new Date(factura.fecha).toISOString()}</fecha>
  <cliente nit="${escapeXml(factura.cliente_nit)}">${escapeXml(factura.cliente_nombre)}</cliente>
  <items>${items}
  </items>
  <subtotal>${Number(factura.subtotal).toFixed(2)}</subtotal>
  <descuento>${Number(factura.descuento).toFixed(2)}</descuento>
  <impuesto>${Number(factura.impuesto).toFixed(2)}</impuesto>
  <total>${Number(factura.total).toFixed(2)}</total>
</factura>`;
}

/** TDSI-107/351/352: genera el PDF y el XML de la factura y deja listo el registro para entregarlos */
async function generarDocumentosFactura(numero) {
  const factura = await facturasRepo.obtenerFacturaCompleta(numero);
  if (!factura) {
    const e = new Error("Factura no encontrada");
    e.status = 404;
    throw e;
  }

  fs.mkdirSync(CARPETA_STORAGE, { recursive: true });

  const pdfBuffer = await generarPdfBuffer(factura);
  const rutaPdf = path.join(CARPETA_STORAGE, `${factura.numero}.pdf`);
  fs.writeFileSync(rutaPdf, pdfBuffer);

  const xml = generarXml(factura);
  const rutaXml = path.join(CARPETA_STORAGE, `${factura.numero}.xml`);
  fs.writeFileSync(rutaXml, xml, "utf8");

  const generadoEn = new Date();
  const docPdf = await documentosRepo.insertarDocumento({
    factura_id: factura.id, tipo: "PDF", ruta_o_url: rutaPdf, estado: "Listo", generado_en: generadoEn,
  });
  const docXml = await documentosRepo.insertarDocumento({
    factura_id: factura.id, tipo: "XML", ruta_o_url: rutaXml, estado: "Listo", generado_en: generadoEn,
  });

  return { pdf: docPdf, xml: docXml };
}

/** TDSI-353: entrega al Sistema Cliente el archivo PDF/XML ya generado de la factura */
async function obtenerArchivoParaEntrega(numero, tipo) {
  const tipoNormalizado = String(tipo || "").toLowerCase();
  if (!TIPOS_VALIDOS.includes(tipoNormalizado)) {
    const e = new Error(`El tipo de documento debe ser: ${TIPOS_VALIDOS.join(" o ")}.`);
    e.status = 400;
    throw e;
  }

  const factura = await facturasRepo.obtenerFacturaCompleta(numero);
  if (!factura) {
    const e = new Error("Factura no encontrada");
    e.status = 404;
    throw e;
  }

  const documento = await documentosRepo.buscarPorFacturaYTipo(factura.id, tipoNormalizado.toUpperCase());
  if (!documento) {
    const e = new Error(`Esta factura no tiene un documento ${tipoNormalizado.toUpperCase()} generado.`);
    e.status = 404;
    throw e;
  }
  if (documento.estado !== "Listo") {
    const e = new Error(`El documento ${tipoNormalizado.toUpperCase()} aun no esta listo (estado: ${documento.estado}).`);
    e.status = 409;
    throw e;
  }

  const archivo = fs.readFileSync(documento.ruta_o_url);

  // TDSI-354: se registra la entrega solo si de verdad se pudo leer el archivo
  const documentoEntregado = await documentosRepo.marcarEntregado(documento.id);

  return {
    archivo,
    contentType: CONTENT_TYPES[tipoNormalizado],
    nombreArchivo: `${factura.numero}.${tipoNormalizado}`,
    documento: documentoEntregado,
  };
}

module.exports = { generarDocumentosFactura, obtenerArchivoParaEntrega };
