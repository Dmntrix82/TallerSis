const { AppError } = require("../utils/AppError");
const { obtenerReporteVentas } = require("./pagosProxy");
const cajasRepo = require("../data/cajasRepo");

/** Valida y normaliza el rango de fechas (desde, hasta). */
function validarRango(desde, hasta) {
  const d = desde ? new Date(desde) : null;
  const h = hasta ? new Date(hasta) : null;

  if (desde && Number.isNaN(d.getTime())) throw new AppError("'desde' no es una fecha válida", 400, { desde });
  if (hasta && Number.isNaN(h.getTime())) throw new AppError("'hasta' no es una fecha válida", 400, { hasta });
  if (d && h && d > h) throw new AppError("'desde' no puede ser mayor que 'hasta'", 400, { desde, hasta });

  return { desde: d, hasta: h };
}

/**
 * TDSI-479: calcula el total recaudado por caja y rango de fechas.
 * Reutiliza pagosProxy.obtenerReporteVentas (que consulta gestion_pagos).
 *
 * - Si viene caja_id → un solo objeto con los totales de esa caja.
 * - Si no viene caja_id → un array con un objeto por cada caja activa.
 */
async function calcularRecaudadoPorCaja({ caja_id, desde, hasta }) {
  const { desde: d, hasta: h } = validarRango(desde, hasta);

  // Rango por defecto: hoy (00:00 a 23:59:59)
  const hoy = new Date();
  const desdeFinal = d || new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const hastaFinal = h || new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1);

  if (caja_id) {
    const caja = await cajasRepo.buscarPorCodigo(caja_id);
    if (!caja) throw new AppError(`La caja "${caja_id}" no existe`, 404, { caja_id });

    const reporte = await obtenerReporteVentas({ caja_id, desde: desdeFinal, hasta: hastaFinal });
    return {
      caja_id,
      caja_nombre: caja.nombre,
      desde: desdeFinal,
      hasta: hastaFinal,
      totalIngresos: reporte.totalGeneral,
      totalEgresos: 0, // TDSI-480 lo amplía
      totalRecaudado: reporte.totalGeneral,
      operaciones: reporte.cantidadVentas,
      porMetodo: {
        Efectivo: { ingresos: reporte.totalEfectivo, egresos: 0, neto: reporte.totalEfectivo, operaciones: reporte.operacionesPorMetodo.Efectivo },
        Tarjeta:  { ingresos: reporte.totalTarjeta,  egresos: 0, neto: reporte.totalTarjeta,  operaciones: reporte.operacionesPorMetodo.Tarjeta },
        QR:       { ingresos: reporte.totalQR,       egresos: 0, neto: reporte.totalQR,       operaciones: reporte.operacionesPorMetodo.QR },
      },
    };
  }

  // Sin caja_id → todas las cajas activas
  const cajas = await cajasRepo.listarActivas();
  const resultados = [];
  for (const caja of cajas) {
    const reporte = await obtenerReporteVentas({ caja_id: caja.codigo, desde: desdeFinal, hasta: hastaFinal });
    resultados.push({
      caja_id: caja.codigo,
      caja_nombre: caja.nombre,
      desde: desdeFinal,
      hasta: hastaFinal,
      totalIngresos: reporte.totalGeneral,
      totalEgresos: 0,
      totalRecaudado: reporte.totalGeneral,
      operaciones: reporte.cantidadVentas,
      porMetodo: {
        Efectivo: { ingresos: reporte.totalEfectivo, egresos: 0, neto: reporte.totalEfectivo, operaciones: reporte.operacionesPorMetodo.Efectivo },
        Tarjeta:  { ingresos: reporte.totalTarjeta,  egresos: 0, neto: reporte.totalTarjeta,  operaciones: reporte.operacionesPorMetodo.Tarjeta },
        QR:       { ingresos: reporte.totalQR,       egresos: 0, neto: reporte.totalQR,       operaciones: reporte.operacionesPorMetodo.QR },
      },
    });
  }
  return resultados;
}

module.exports = { calcularRecaudadoPorCaja };