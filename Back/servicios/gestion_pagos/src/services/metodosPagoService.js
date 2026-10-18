const repo = require("../data/metodosPagoRepo");
const { METODOS } = require("./revisionService");
const { validarFechaDia } = require("../utils/fechaLocal");

const sumar = (valores) => Math.round(valores.reduce((a, b) => a + b, 0) * 100) / 100;

/**
 * TDSI-435: monitoreo de metodos de pago de un dia (por defecto hoy, hora de Bolivia).
 * Por cada metodo: cantidad de ventas, monto cobrado y porcentaje del monto total.
 * Siempre trae los 3 metodos (Efectivo, Tarjeta, QR), aunque esten en 0.
 */
async function monitorearMetodos({ fecha } = {}) {
  const dia = validarFechaDia(fecha, "fecha");
  const filas = await repo.agruparPorMetodo({ desde: dia, hasta: dia });

  const metodos = METODOS.map((metodo) => filas.find((f) => f.metodo === metodo) || { metodo, cantidad: 0, monto: 0, porcentaje: 0 });

  return {
    filtros: { desde: dia, hasta: dia },
    cantidad_operaciones: metodos.reduce((a, m) => a + m.cantidad, 0),
    monto_total: sumar(metodos.map((m) => m.monto)),
    metodos,
  };
}

module.exports = { monitorearMetodos };