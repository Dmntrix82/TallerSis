// TDSI-51/683: emite la factura de una venta online a traves del microservicio
// facturacion, que es el dueno real de la numeracion oficial (F-NNNNNN) -- gestion_pagos
// nunca inventa su propio numero de factura. Mismo patron que clientesProxy.js.
const FACTURACION_URL = process.env.FACTURACION_URL || "http://localhost:4002";

/** Devuelve la factura creada ({ numero, id, ... }); lanza un Error con un mensaje claro si falla. */
async function emitirFactura({ nit, razon_social, items }) {
  let respuesta;
  try {
    respuesta = await fetch(`${FACTURACION_URL}/api/facturas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nit, razon_social, items }),
    });
  } catch (e) {
    throw new Error("No se pudo contactar a facturacion para emitir la factura.");
  }

  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    throw new Error(datos?.mensaje || "facturacion no pudo emitir la factura.");
  }
  return datos.data;
}

module.exports = { emitirFactura };
