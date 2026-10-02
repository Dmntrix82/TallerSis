const { AppError } = require("../utils/AppError");

// TDSI-323: gestion_caja NUNCA duplica los datos de venta -- pagos.transacciones en
// gestion_pagos es la fuente real (caja.movimientos nunca llego a alimentarse desde
// ningun microservicio, asi que el cierre de caja se calcula consultando aca por HTTP).
const GESTION_PAGOS_URL = process.env.GESTION_PAGOS_URL || "http://localhost:4005";

/** Reporte de ventas de una caja entre "desde" (apertura del turno) y "hasta" (ahora o el cierre). */
async function obtenerReporteVentas({ caja_id, desde, hasta }) {
  const params = new URLSearchParams({ caja_id, desde: new Date(desde).toISOString() });
  if (hasta) params.set("hasta", new Date(hasta).toISOString());

  let respuesta;
  try {
    respuesta = await fetch(`${GESTION_PAGOS_URL}/api/pagos/reporte-turno?${params.toString()}`);
  } catch (e) {
    throw new AppError("No se pudo obtener el reporte de ventas de este turno. Intente de nuevo.", 502);
  }

  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    throw new AppError(datos?.mensaje || "No se pudo obtener el reporte de ventas de este turno.", respuesta.status);
  }
  return datos.data;
}

module.exports = { obtenerReporteVentas };
