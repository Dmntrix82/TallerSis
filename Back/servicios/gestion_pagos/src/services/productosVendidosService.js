const { AppError } = require("../utils/AppError");
const repo = require("../data/productosVendidosRepo");

/**
 * TDSI-54/185: productos vendidos de un dia (fecha "YYYY-MM-DD"), agrupados por
 * producto, ordenados de mas a menos vendido, sin contar facturas anuladas.
 */
async function obtenerProductosVendidos(fecha) {
  if (!fecha) {
    throw new AppError("Falta la fecha para agrupar los productos vendidos.", 400);
  }
  const desde = new Date(`${fecha}T00:00:00`);
  const hasta = new Date(`${fecha}T23:59:59.999`);
  if (Number.isNaN(desde.getTime())) {
    throw new AppError("La fecha no es válida.", 400, { fecha });
  }

  const productos = await repo.agruparPorProducto(desde, hasta);
  return { fecha, productos };
}

module.exports = { obtenerProductosVendidos };
