const repo = require("../data/metodosPagoRepo");
const { METODOS, validarRango } = require("./revisionService");
const { validarCajaOpcional, validarCajeroOpcional } = require("./historialCajerosService");

const metodoEnCero = (metodo) => ({
  metodo,
  cantidad: 0,
  monto: 0,
  porcentaje: 0,
  simples: { cantidad: 0, monto: 0 },
  mixtos: { cantidad: 0, monto: 0 },
});

/**
 * TDSI-435: monitoreo de metodos de pago (por defecto el dia de hoy, hora de Bolivia).
 * Por cada metodo: cantidad de ventas, monto cobrado y porcentaje del monto total.
 * Siempre trae los 3 metodos (Efectivo, Tarjeta, QR), aunque esten en 0.
 * TDSI-436: incluye los pagos mixtos desglosados (cada parte en su metodo), cuanto de cada metodo
 * viene de pagos simples y cuanto de mixtos, y las combinaciones de metodos de los mixtos.
 * cantidad_operaciones cuenta cada venta una vez; en "metodos", una venta mixta cuenta en cada
 * metodo que uso (por eso la suma de las cantidades por metodo puede ser mayor).
 * TDSI-437: filtros opcionales: fecha (un dia) o desde/hasta (rango, maximo 92 dias; sin fechas = hoy),
 * caja_id y cajero_id.
 */
async function monitorearMetodos({ fecha, desde, hasta, caja_id, cajero_id } = {}) {
  const rango = validarRango({ fecha, desde, hasta });
  const cajaId = validarCajaOpcional(caja_id);
  const cajeroId = validarCajeroOpcional(cajero_id);
  const filtros = { ...rango, cajaId, cajeroId };
  const [filas, totales] = await Promise.all([repo.agruparPorMetodo(filtros), repo.totalesYMixtos(filtros)]);

  return {
    filtros: { ...rango, caja_id: cajaId, cajero_id: cajeroId },
    cantidad_operaciones: totales.cantidad_operaciones,
    monto_total: totales.monto_total,
    metodos: METODOS.map((metodo) => filas.find((f) => f.metodo === metodo) || metodoEnCero(metodo)),
    pagos_mixtos: totales.pagos_mixtos,
  };
}

module.exports = { monitorearMetodos };