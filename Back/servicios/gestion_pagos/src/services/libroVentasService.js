const { AppError } = require("../utils/AppError");
const repo = require("../data/pagosRepo");
const { aCentavos, aMonto } = require("../utils/money");

// TDSI-747: igual que calculoFacturaService, el 13% de IVA del sistema.
const TASA_IVA = 0.13;

function validarMesAnio(mes, anio) {
  const mesNum = Number(mes);
  const anioNum = Number(anio);
  if (!Number.isInteger(mesNum) || mesNum < 1 || mesNum > 12) {
    throw new AppError("El mes debe ser un número entero entre 1 y 12.", 400, { mes });
  }
  if (!Number.isInteger(anioNum) || anioNum < 2000 || anioNum > 2100) {
    throw new AppError("El año debe ser un número entero válido (2000-2100).", 400, { anio });
  }
  return { mes: mesNum, anio: anioNum };
}

/**
 * TDSI-50/747: el total que ya tiene la venta incluye el IVA (no es un monto
 * "más IVA aparte"), asi que el importe base se obtiene dividiendo entre 1.13
 * y el debito fiscal es la diferencia -- asi base + debito siempre da
 * exactamente el total, sin descuadres de centavos por redondear cada uno
 * por separado.
 */
function calcularBaseYDebito(total) {
  const totalC = aCentavos(total);
  const baseC = Math.round(totalC / (1 + TASA_IVA));
  const debitoC = totalC - baseC;
  return { importe_base: aMonto(baseC), debito_fiscal: aMonto(debitoC) };
}

/**
 * TDSI-747: arma la fila del libro para una factura. Las anuladas se
 * muestran con estado "A" y todos sus importes en cero (no entran al total
 * del mes), tal como lo pide la regla de negocio -- el dato real sigue en la
 * base, solo que el libro no las cuenta como venta.
 */
function calcularFila(factura, numero) {
  const esAnulada = factura.estado === "Anulado";
  const total = esAnulada ? 0 : factura.total;
  const { importe_base, debito_fiscal } = esAnulada
    ? { importe_base: 0, debito_fiscal: 0 }
    : calcularBaseYDebito(total);

  return {
    numero,
    fecha: factura.fecha,
    numero_factura: factura.id_transaccion,
    nit_ci: factura.nit || "",
    razon_social: factura.razon_social || "Consumidor final",
    total,
    descuento: 0, // el sistema no maneja descuentos por factura todavia
    importe_base,
    debito_fiscal,
    estado: esAnulada ? "A" : "V",
  };
}

/** TDSI-50/748: filas del libro de ventas del mes + los totales (solo de las validas). */
async function obtenerLibroVentas(mes, anio) {
  const { mes: mesValido, anio: anioValido } = validarMesAnio(mes, anio);

  const facturas = await repo.listarFacturasDelMes(mesValido, anioValido);
  const filas = facturas.map((f, i) => calcularFila(f, i + 1));

  const totales = filas.reduce(
    (acc, f) => ({
      total: aMonto(aCentavos(acc.total) + aCentavos(f.total)),
      descuento: aMonto(aCentavos(acc.descuento) + aCentavos(f.descuento)),
      importe_base: aMonto(aCentavos(acc.importe_base) + aCentavos(f.importe_base)),
      debito_fiscal: aMonto(aCentavos(acc.debito_fiscal) + aCentavos(f.debito_fiscal)),
    }),
    { total: 0, descuento: 0, importe_base: 0, debito_fiscal: 0 }
  );

  return { mes: mesValido, anio: anioValido, filas, totales };
}

module.exports = { obtenerLibroVentas, calcularBaseYDebito, validarMesAnio };
