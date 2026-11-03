const { AppError } = require("../utils/AppError");
const repo = require("../data/productosVendidosRepo");
const { publicar } = require("../clients/pubsubPublisher");

/**
 * TDSI-54/185: productos vendidos de un dia (fecha "YYYY-MM-DD"), agrupados por
 * producto, ordenados de mas a menos vendido, sin contar facturas anuladas.
 */
async function obtenerProductosVendidos(fecha) {
  if (!fecha) {
    throw new AppError("Falta la fecha para agrupar los productos vendidos.", 400);
  }
  const desde = new Date(`${fecha}T00:00:00`);
  const hasta = new Date(`${fecha}T23:59:59.999`);
  if (Number.isNaN(desde.getTime())) {
    throw new AppError("La fecha no es válida.", 400, { fecha });
  }

  const productos = await repo.agruparPorProducto(desde, hasta);
  return { fecha, productos };
}

/**
 * TDSI-54/682: arma y publica el reporte del dia en "pagos-productos-vendidos", con un
 * identificador unico por fecha ("PV-<fecha>") para que Compras lo pueda tratar como
 * idempotente. "Si no hubo ventas ese dia, no se puede enviar" (regla del ticket) -- el
 * resto de las reglas (una vez por dia salvo Error, tabla de envios, acuse) son
 * subtasks aparte que todavia no existen.
 */
async function publicarProductosVendidos(fecha) {
  const { productos } = await obtenerProductosVendidos(fecha);
  if (productos.length === 0) {
    throw new AppError("No hubo ventas ese día; no se puede enviar a Compras.", 409, { fecha });
  }

  const reporteId = `PV-${fecha}`;
  const mensaje = {
    reporte_id: reporteId,
    origen: "gestion_pagos",
    fecha,
    productos,
    generado_en: new Date().toISOString(),
  };

  const resultado = await publicar(mensaje, {
    tipo: "PRODUCTOS_VENDIDOS",
    fecha,
    reporte_id: reporteId,
    idempotency_key: reporteId,
    origen: "gestion_pagos",
  });

  return { mensaje, resultado };
}

module.exports = { obtenerProductosVendidos, publicarProductosVendidos };
