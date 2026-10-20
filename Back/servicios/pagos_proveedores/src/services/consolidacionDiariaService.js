const cfg = require("../config/integraciones");
const egresosRepo = require("../data/egresosRepo");
const { obtenerIngresosDelDia } = require("../clients/ingresosProxy");
const { validarFechaCierre } = require("../utils/fecha");

const redondear = (v) => Math.round(v * 100) / 100;

/**
 * TDSI-415: reune en un solo objeto los ingresos (gestion_pagos, via proxy) y los
 * egresos (proveedores.egresos, propios de este servicio) de una fecha.
 * Si gestion_pagos no responde se lanza un 502: nunca se consolida con ingresos en 0.
 */
async function consolidarDia(fecha) {
  const fechaValida = validarFechaCierre(fecha);

  const [ingresos, egresosPorMetodo, egresosDetalle] = await Promise.all([
    obtenerIngresosDelDia(fechaValida),
    egresosRepo.egresosDelDiaPorMetodo(fechaValida),
    egresosRepo.egresosDelDia(fechaValida), // TDSI-22: detalle para el reporte a Contabilidad
  ]);

  const egresos = {
    origen: "PROVEEDORES",
    porMetodo: egresosPorMetodo,
    total: redondear(egresosPorMetodo.reduce((acc, m) => acc + m.total, 0)),
    cantidad: egresosPorMetodo.reduce((acc, m) => acc + m.cantidad, 0),
    detalle: egresosDetalle,
  };

  return { fecha: fechaValida, modoAislado: cfg.MODO_AISLADO, ingresos, egresos };
}

module.exports = { consolidarDia };