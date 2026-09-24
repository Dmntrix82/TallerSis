const { aCentavos, aMonto, porcentaje } = require("../utils/money");
const { AppError } = require("../utils/AppError");
const repo = require("../data/pagosRepo");

const METODOS_VALIDOS = ["Efectivo", "Tarjeta", "QR"];

/**
 * TDSI-87: calcula y divide el pago entre dos metodos. (Logica pura, sin BD.)
 */
function calcularDivision({ total, metodos, efectivoRecibido = null }) {
  const totalC = aCentavos(total);
  if (!Number.isFinite(totalC) || totalC <= 0)
    throw new AppError("El total de la venta debe ser un numero mayor a 0", 400);
  if (!Array.isArray(metodos) || metodos.length !== 2)
    throw new AppError("El pago mixto requiere exactamente 2 metodos de pago", 400);

  const [m1, m2] = metodos;
  for (const m of metodos) {
    if (!m || !METODOS_VALIDOS.includes(m.metodo))
      throw new AppError(`Metodo no valido: ${m && m.metodo}. Use: ${METODOS_VALIDOS.join(", ")}`, 400);
  }
  if (m1.metodo === m2.metodo)
    throw new AppError("Los dos metodos de pago deben ser diferentes", 400);

  const usaPorcentaje = metodos.some((m) => m.porcentaje !== undefined && m.porcentaje !== null);
  const definidos = metodos.filter((m) => m.monto !== undefined && m.monto !== null);

  let c1, c2;
  if (usaPorcentaje) {
    const p1 = Number(m1.porcentaje != null ? m1.porcentaje : 100 - Number(m2.porcentaje));
    const p2 = Number(m2.porcentaje != null ? m2.porcentaje : 100 - p1);
    if (Math.round((p1 + p2) * 100) !== 10000)
      throw new AppError("Los porcentajes deben sumar exactamente 100", 422, { p1, p2 });
    c1 = Math.round((totalC * p1) / 100);
    c2 = totalC - c1;
  } else if (definidos.length === 2) {
    c1 = aCentavos(m1.monto);
    c2 = aCentavos(m2.monto);
  } else if (definidos.length === 1) {
    if (m1.monto != null) { c1 = aCentavos(m1.monto); c2 = totalC - c1; }
    else { c2 = aCentavos(m2.monto); c1 = totalC - c2; }
  } else {
    c1 = Math.round(totalC / 2);
    c2 = totalC - c1;
  }

  if (c1 <= 0 || c2 <= 0)
    throw new AppError("Cada metodo debe recibir un monto mayor a 0", 422, {
      monto1: aMonto(c1), monto2: aMonto(c2),
    });

  const diferencia = c1 + c2 - totalC;
  if (diferencia !== 0)
    throw new AppError("La suma de los dos montos no coincide con el total de la venta", 422, {
      total: aMonto(totalC),
      sumaRecibida: aMonto(c1 + c2),
      faltante: diferencia < 0 ? aMonto(Math.abs(diferencia)) : 0,
      excedente: diferencia > 0 ? aMonto(diferencia) : 0,
    });

  const detalle = [
    { metodo: m1.metodo, monto: aMonto(c1), porcentaje: porcentaje(c1, totalC), referencia: m1.referencia || null, orden: 1 },
    { metodo: m2.metodo, monto: aMonto(c2), porcentaje: porcentaje(c2, totalC), referencia: m2.referencia || null, orden: 2 },
  ];

  let cambio = null;
  const efectivo = detalle.find((d) => d.metodo === "Efectivo");
  if (efectivo && efectivoRecibido != null) {
    const recibidoC = aCentavos(efectivoRecibido);
    const efectivoC = aCentavos(efectivo.monto);
    if (recibidoC < efectivoC)
      throw new AppError("El efectivo recibido es menor al monto asignado a efectivo", 422, {
        recibido: aMonto(recibidoC), requerido: efectivo.monto,
      });
    cambio = aMonto(recibidoC - efectivoC);
  }

  return { total: aMonto(totalC), tipoPago: "Mixto", cuadra: true, restante: 0, cambio, metodos: detalle };
}

/** TDSI-276 + TDSI-277: guarda en Postgres (cabecera + detalle + historial de caja). */
async function registrarPagoMixto(payload) {
  const { id_transaccion, cajaId, turnoId } = payload;
  if (!id_transaccion) throw new AppError("El campo 'id_transaccion' es obligatorio", 400);

  if (await repo.existePagoMixto(id_transaccion))
    throw new AppError("Esta transaccion ya tiene un pago mixto registrado", 409, { id_transaccion });

  const calculo = calcularDivision(payload);

  const resultado = await repo.registrarPagoMixtoCompleto({
    id_transaccion,
    cajaId,
    turnoId,
    total: calculo.total,
    metodos: calculo.metodos,
  });

  return { ...resultado, cambio: calculo.cambio };
}

async function obtenerPorTransaccion(id_transaccion) {
  const pago = await repo.obtenerPagoMixtoPorTransaccion(id_transaccion);
  if (!pago) throw new AppError("No existe un pago mixto para esa transaccion", 404);
  return pago;
}

module.exports = { calcularDivision, registrarPagoMixto, obtenerPorTransaccion };