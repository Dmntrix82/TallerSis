const repo = require("../data/turnosRepo");
const { AppError } = require("../utils/AppError");
const { validarSupervisor } = require("./supervisorProxy");

const MONTO_MAXIMO = 999999999999.99; // límite de NUMERIC(14,2)

function validarEfectivoInicial(valor) {
  if (valor === undefined || valor === null || valor === "")
    throw new AppError("El campo 'efectivo_inicial' es obligatorio");

  const monto = Number(valor);
  if (Number.isNaN(monto) || !Number.isFinite(monto))
    throw new AppError("El efectivo inicial debe ser un número válido", 400, { efectivo_inicial: valor });
  if (monto < 0)
    throw new AppError("El efectivo inicial no puede ser negativo", 400, { efectivo_inicial: monto });
  if (monto > MONTO_MAXIMO)
    throw new AppError("El efectivo inicial supera el monto máximo permitido", 400, { efectivo_inicial: monto });
  if (!/^\d+(\.\d{1,2})?$/.test(String(valor).trim()))
    throw new AppError("El efectivo inicial debe tener como máximo 2 decimales", 400, { efectivo_inicial: valor });

  return Math.round(monto * 100) / 100;
}

function validarTexto(valor, campo, max) {
  if (!valor || typeof valor !== "string" || !valor.trim())
    throw new AppError(`El campo '${campo}' es obligatorio y debe ser texto`);
  const limpio = valor.trim();
  if (limpio.length > max) throw new AppError(`El campo '${campo}' no puede superar ${max} caracteres`);
  return limpio;
}

/**
 * TDSI-311 + TDSI-312: registrar monto inicial y guardar fecha, hora y cajero.
 * El terminal no se habilita solo: un supervisor de caja tiene que autorizarlo
 * con su usuario + PIN (mismo registro de supervisores que usa facturacion
 * para las anulaciones, validado via supervisorProxy.js).
 */
async function abrirTurno({ caja_id, cajero_id, efectivo_inicial, supervisor_id, pin } = {}) {
  const cajaId = validarTexto(caja_id, "caja_id", 20);
  const cajeroId = validarTexto(cajero_id, "cajero_id", 60);
  const monto = validarEfectivoInicial(efectivo_inicial);

  if (!supervisor_id || !pin) {
    throw new AppError("Se necesita el usuario y el PIN de un supervisor para habilitar la caja.", 400);
  }

  const caja = await repo.buscarCajaPorCodigo(cajaId);
  if (!caja) throw new AppError("La caja no existe", 404, { caja_id: cajaId });
  if (caja.estado !== "ACTIVA") throw new AppError("La caja está inactiva", 409, { caja_id: cajaId });

    // TDSI-313: no permitir dos turnos abiertos en la misma caja
  const turnoAbierto = await repo.buscarTurnoAbiertoPorCaja(cajaId);
  if (turnoAbierto)
    throw new AppError(
      "Ya existe un turno abierto para esta caja",
      409,
      { caja_id: cajaId, turno_abierto: turnoAbierto.codigo }
    );

  // Se valida al final, justo antes de crear el turno: no tiene sentido gastar
  // un intento de PIN si la caja ya estaba inactiva o con un turno abierto.
  const supervisor = await validarSupervisor({ supervisor_id, pin });

  const turno = await repo.crearTurno({
    caja_id: cajaId,
    cajero_id: cajeroId,
    efectivo_inicial: monto,
    autorizado_por: supervisor.supervisor_id,
    autorizado_por_nombre: supervisor.nombre,
  });

  return {
    ...turno,
    id: Number(turno.id),
    efectivo_inicial: Number(turno.efectivo_inicial),
  };
}

/** Turno abierto de una caja, para que el frontend no tenga que pedirle el id al cajero. */
async function obtenerTurnoAbierto(caja_id) {
  const cajaId = validarTexto(caja_id, "caja_id", 20);
  const turno = await repo.buscarTurnoAbiertoPorCaja(cajaId);
  if (!turno) throw new AppError(`No hay un turno abierto para la caja "${cajaId}".`, 404, { caja_id: cajaId });
  return { ...turno, id: Number(turno.id) };
}

/**
 * Una caja solo puede tener un cajero a la vez: si ya hay un turno abierto,
 * unicamente la cuenta que lo abrio puede volver a entrar a esa caja hasta
 * que se cierre. Se llama en el login, antes de habilitar el terminal.
 */
async function verificarCajaLibreParaCajero(caja_id, cajero_email) {
  const turnoAbierto = await repo.buscarTurnoAbiertoPorCaja(caja_id);
  if (turnoAbierto && turnoAbierto.cajero_id !== cajero_email) {
    throw new AppError(
      `La caja "${caja_id}" ya tiene un turno abierto por otro cajero. Solo esa cuenta puede usarla hasta que se cierre.`,
      403,
      { caja_id, cajero_actual: turnoAbierto.cajero_id }
    );
  }
}

module.exports = { abrirTurno, obtenerTurnoAbierto, verificarCajaLibreParaCajero };