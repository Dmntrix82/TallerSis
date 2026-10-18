const repo = require("../data/metodosPagoRepo");
const { METODOS } = require("./revisionService");
const { validarFechaDia } = require("../utils/fechaLocal");

const metodoEnCero = (metodo) => ({
  metodo,
  cantidad: 0,
  monto: 0,
  porcentaje: 0,
  simples: { cantidad: 0, monto: 0 },
  mixtos: { cantidad: 0, monto: 0 },
});

/**
 * TDSI-435: monitoreo de metodos de pago de un dia (por defecto hoy, hora de Bolivia).
 * Por cada metodo: cantidad de ventas, monto cobrado y porcentaje del monto total.
 * Siempre trae los 3 metodos (Efectivo, Tarjeta, QR), aunque esten en 0.
 * TDSI-436: incluye los pagos mixtos desglosados (cada parte en su metodo), cuanto de cada metodo
 * viene de pagos simples y cuanto de mixtos, y las combinaciones de metodos de los mixtos.
 * cantidad_operaciones cuenta cada venta una vez; en "metodos", una venta mixta cuenta en cada
 * metodo que uso (por eso la suma de las cantidades por metodo puede ser mayor).
 */
async function monitorearMetodos({ fecha } = {}) {
  const dia = validarFechaDia(fecha, "fecha");
  const filtros = { desde: dia, hasta: dia };
  const [filas, totales] = await Promise.all([repo.agruparPorMetodo(filtros), repo.totalesYMixtos(filtros)]);

  return {
    filtros,
    cantidad_operaciones: totales.cantidad_operaciones,
    monto_total: totales.monto_total,
    metodos: METODOS.map((metodo) => filas.find((f) => f.metodo === metodo) || metodoEnCero(metodo)),
    pagos_mixtos: totales.pagos_mixtos,
  };
}

module.exports = { monitorearMetodos };