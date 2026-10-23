const { IVA_PORCENTAJE } = require("../config/cierre");
const { consolidarDia } = require("./consolidacionDiariaService");

// Se trabaja en centavos (enteros) para que 0.1 + 0.2 no de 0.30000000000000004.
const aCentavos = (v) => Math.round(Number(v || 0) * 100);
const aBs = (c) => c / 100;

/**
 * TDSI-416: calcula los totales del lote a partir de lo consolidado (TDSI-415).
 *   impuestos = IVA incluido en las ventas del dia (ingresos x IVA%)
 *   neto      = ingresos - egresos - impuestos
 * Es una funcion pura (sin BD ni HTTP) para poder probarla de forma aislada.
 */
function calcularTotales({ ingresos, egresos }, ivaPorcentaje = IVA_PORCENTAJE) {
  const ingresosC = aCentavos(ingresos?.total);
  const egresosC = aCentavos(egresos?.total);
  const impuestosC = Math.round((ingresosC * ivaPorcentaje) / 100);
  const netoC = ingresosC - egresosC - impuestosC;

  return {
    totalIngresos: aBs(ingresosC),
    totalEgresos: aBs(egresosC),
    totalImpuestos: aBs(impuestosC),
    totalNeto: aBs(netoC),
    ivaPorcentaje,
  };
}

/** TDSI-416: consolida el dia y devuelve sus totales junto con el detalle que los origina. */
async function calcularTotalesDelDia(fecha) {
  const consolidado = await consolidarDia(fecha);
  return {
    fecha: consolidado.fecha,
    modoAislado: consolidado.modoAislado,
    ...calcularTotales(consolidado),
    detalle: { ingresos: consolidado.ingresos, egresos: consolidado.egresos },
  };
}

module.exports = { calcularTotales, calcularTotalesDelDia };