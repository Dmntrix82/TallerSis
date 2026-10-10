const { AppError } = require("../utils/AppError");
const cajasRepo = require("../data/cajasRepo");

/** TDSI-266: valida que la caja/terminal exista y este activa antes de habilitarla */
async function validarCajaDisponible(caja_id) {
  if (!caja_id) {
    throw new AppError("El campo caja_id es obligatorio.", 400);
  }

  const caja = await cajasRepo.buscarPorCodigo(caja_id);

  if (!caja) {
    throw new AppError(`La caja "${caja_id}" no existe.`, 404);
  }
  if (caja.estado !== "ACTIVA") {
    throw new AppError(`La caja "${caja_id}" esta inactiva, no se puede habilitar el terminal.`, 403);
  }

  return caja;
}

/** Lista de cajas activas, para el selector de "Caja / terminal" del login. */
async function listarCajasActivas() {
  return cajasRepo.listarActivas();
}
/**
 * TDSI-24/464: calcula el estado OPERATIVO de una caja.
 *
 * - Si la caja esta INACTIVA (catalogo) -> "INACTIVA" (gana sobre todo lo demas).
 * - Si esta ACTIVA y tiene un turno ABIERTO -> "ABIERTA".
 * - Si esta ACTIVA y NO tiene turno abierto -> "CERRADA".
 */
function calcularEstadoOperativo(caja, tieneTurnoAbierto) {
  if (caja.estado === "INACTIVA") return "INACTIVA";
  return tieneTurnoAbierto ? "ABIERTA" : "CERRADA";
}

/**
 * TDSI-24/125 + 465: consulta el estado de las cajas con filtros opcionales.
 *
 * @param {object} filtros
 * @param {string} [filtros.estado]  "ABIERTA" | "CERRADA" | "INACTIVA"
 * @param {boolean} [filtros.activa]  true (solo ACTIVA) | false (solo INACTIVA)
 * @returns {Promise<{total: number, cajas: Array}>}
 */
async function consultarEstadoCajas(filtros = {}) {
  const { estado, activa } = filtros;

  const ESTADOS_VALIDOS = ["ABIERTA", "CERRADA", "INACTIVA"];
  if (estado !== undefined && !ESTADOS_VALIDOS.includes(estado)) {
    throw new AppError(
      `El filtro 'estado' debe ser uno de: ${ESTADOS_VALIDOS.join(", ")}`,
      400,
      { estado }
    );
  }
  if (activa !== undefined && typeof activa !== "boolean") {
    throw new AppError("El filtro 'activa' debe ser booleano", 400, { activa });
  }

  const [cajas, cajasConTurnoAbierto] = await Promise.all([
    cajasRepo.listarTodas(),
    cajasRepo.obtenerCajasConTurnoAbierto(),
  ]);

  const setConTurno = new Set(cajasConTurnoAbierto);

  let resultado = cajas.map((c) => ({
    codigo: c.codigo,
    nombre: c.nombre,
    estado: calcularEstadoOperativo(c, setConTurno.has(c.codigo)),
    activa: c.estado === "ACTIVA",
  }));

  if (estado !== undefined) {
    resultado = resultado.filter((c) => c.estado === estado);
  }
  if (activa !== undefined) {
    resultado = resultado.filter((c) => c.activa === activa);
  }

  return { total: resultado.length, cajas: resultado };
}
module.exports = {
  validarCajaDisponible,
  listarCajasActivas,
  calcularEstadoOperativo,
  consultarEstadoCajas,
};
