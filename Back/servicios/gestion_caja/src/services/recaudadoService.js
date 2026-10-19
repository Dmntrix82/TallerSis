const { AppError } = require("../utils/AppError");
const { obtenerReporteVentas } = require("./pagosProxy");
const cajasRepo = require("../data/cajasRepo");
const { hoyLocal, validarDia, limitesDelRango } = require("../utils/fechas");

/**
 * TDSI-481: rango de dias (inclusive) en hora de Bolivia. Sin fechas es hoy; con solo
 * "desde" o solo "hasta", es ese dia. Devuelve los dias y los instantes exactos:
 * desde las 00:00 del primer dia hasta las 23:59:59.999 del ultimo (gestion_pagos usa <=).
 */
function validarRango(desde, hasta) {
  const diaDesde = desde ? validarDia(desde, "desde") : null;
  const diaHasta = hasta ? validarDia(hasta, "hasta") : null;
  const d = diaDesde || diaHasta || hoyLocal();
  const h = diaHasta || diaDesde || d;
  if (d > h) throw new AppError("'desde' no puede ser mayor que 'hasta'", 400, { desde, hasta });

  return { desde: d, hasta: h, ...limitesDelRango(d, h) };
}

/**
 * TDSI-479: calcula el total recaudado por caja y rango de fechas (dias de Bolivia, inclusive).
 * Reutiliza pagosProxy.obtenerReporteVentas (que consulta gestion_pagos).
 *
 * - Si viene caja_id → un solo objeto con los totales de esa caja.
 * - Si no viene caja_id → un array con un objeto por cada caja activa.
 */
async function calcularRecaudadoPorCaja({ caja_id, desde, hasta }) {
  const rango = validarRango(desde, hasta);
  const desdeFinal = rango.inicio;
  const hastaFinal = rango.fin;

// TDSI-480: caja.movimientos solo tiene APERTURA (la tabla está abandonada
// para movimientos reales desde TDSI-314). Tanto el cierre (TDSI-320) como
// este servicio usan egresos = 0. Cuando exista una fuente de egresos por
// caja, ambos deben actualizarse juntos para que el neto cuadre.
  if (caja_id) {
    const caja = await cajasRepo.buscarPorCodigo(caja_id);
    if (!caja) throw new AppError(`La caja "${caja_id}" no existe`, 404, { caja_id });

    const reporte = await obtenerReporteVentas({ caja_id, desde: desdeFinal, hasta: hastaFinal });
    return {
      caja_id,
      caja_nombre: caja.nombre,
      desde: rango.desde,
      hasta: rango.hasta,
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
      desde: rango.desde,
      hasta: rango.hasta,
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