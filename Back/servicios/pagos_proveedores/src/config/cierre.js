// TDSI-416: parametros del calculo del Lote de Cierre Diario.
// En Bolivia el IVA (13%) va incluido en el precio de venta, asi que el impuesto
// del dia se obtiene como un porcentaje de lo vendido, no se suma encima.
function porcentaje(nombre, defecto) {
  const v = Number(process.env[nombre] ?? defecto);
  if (!Number.isFinite(v) || v < 0 || v > 100)
    throw new Error(`${nombre} debe ser un numero entre 0 y 100`);
  return v;
}

module.exports = {
  IVA_PORCENTAJE: porcentaje("IVA_PORCENTAJE", 13),
};