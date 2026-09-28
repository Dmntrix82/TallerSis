const { AppError } = require("../utils/AppError");
const repo = require("../data/resumenVentasRepo");

const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

function validarHora(valor, campo) {
  if (valor === undefined || valor === null || valor === "") return null;
  if (!HORA_REGEX.test(valor)) {
    throw new AppError(`El campo '${campo}' debe tener formato HH:MM (00:00 a 23:59).`, 400, { [campo]: valor });
  }
  return valor;
}

/** TDSI-101/327/328/329: resumen de ventas del turno actual del cajero, por metodo de pago */
/** TDSI-333: admite filtrar ese resumen por un rango de horas del dia */
async function obtenerResumenPorTurno(turnoId, { desde, hasta } = {}) {
  if (!turnoId) {
    throw new AppError("El turnoId es obligatorio.", 400);
  }

  const desdeValido = validarHora(desde, "desde");
  const hastaValida = validarHora(hasta, "hasta");
  // Nota: si desde > hasta (ej. turno "Noche" 18:00-00:00) se interpreta como un
  // rango que cruza la medianoche, no como un error -- ver resumenVentasRepo.js.

  const porMetodo = await repo.resumenPorMetodo(turnoId, { desde: desdeValido, hasta: hastaValida });
  const totalGeneral = porMetodo.reduce((acc, m) => acc + m.total, 0);

  return { turnoId, desde: desdeValido, hasta: hastaValida, porMetodo, totalGeneral };
}

module.exports = { obtenerResumenPorTurno };
