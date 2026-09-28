// Puente hacia el microservicio de facturacion: el Sistema Cliente recibe el PDF/XML
// de la factura a traves de gestion_pagos (que ya lo autentica), sin hablar directo
// con facturacion. Mismo patron que clientesProxy.js.
const FACTURACION_URL = process.env.FACTURACION_URL || "http://localhost:4002";

async function obtenerDocumentoDeFacturacion(numero, tipo) {
  const r = await fetch(
    `${FACTURACION_URL}/api/facturas/${encodeURIComponent(numero)}/documentos/${encodeURIComponent(tipo)}`
  );

  if (!r.ok) {
    const data = await r.json().catch(() => null);
    const e = new Error((data && data.mensaje) || "No se pudo obtener el documento de facturacion");
    e.status = r.status;
    throw e;
  }

  const buffer = Buffer.from(await r.arrayBuffer());
  const contentType = r.headers.get("content-type") || "application/octet-stream";
  return { buffer, contentType };
}

module.exports = { obtenerDocumentoDeFacturacion };
