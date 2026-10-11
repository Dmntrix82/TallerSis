const { AppError } = require("../utils/AppError");
const repo = require("../data/autorizacionesRepo");
const turnosRepo = require("../data/turnosRepo");
const { validarSupervisor } = require("./supervisorProxy");
const { abrirTurno } = require("./turnosService");

/** TDSI-467/127: el cajero solicita abrir una caja. */
async function solicitarApertura({ caja_id, cajero_id, cajero_nombre, efectivo_inicial }) {
  if (!caja_id || !cajero_id) throw new AppError("Faltan 'caja_id' o 'cajero_id'", 400);
  if (efectivo_inicial === undefined || efectivo_inicial === null) {
    throw new AppError("Falta 'efectivo_inicial'", 400);
  }
  const monto = Number(efectivo_inicial);
  if (Number.isNaN(monto) || monto < 0) {
    throw new AppError("El efectivo inicial debe ser un número >= 0", 400);
  }

  const caja = await turnosRepo.buscarCajaPorCodigo(caja_id);
  if (!caja) throw new AppError("La caja no existe", 404, { caja_id });
  if (caja.estado !== "ACTIVA") throw new AppError("La caja está inactiva", 409, { caja_id });

  const turnoAbierto = await turnosRepo.buscarTurnoAbiertoPorCaja(caja_id);
  if (turnoAbierto) throw new AppError("Ya hay un turno abierto en esa caja", 409, { turno_abierto: turnoAbierto.codigo });

  const pendiente = await repo.buscarPendientePorCaja(caja_id);
  if (pendiente) throw new AppError("Ya hay una solicitud pendiente para esa caja", 409, { solicitud_id: pendiente.id });

  return repo.crearSolicitud({ caja_id, cajero_id, cajero_nombre, efectivo_inicial: monto });
}

/** TDSI-582: lista de solicitudes pendientes para el supervisor. */
async function listarPendientes() {
  return repo.listarPendientes();
}

/** TDSI-468/469/605: el supervisor aprueba la solicitud y se abre el turno. */
async function aprobarSolicitud(id, { supervisor_id, pin }) {
  if (!supervisor_id || !pin) throw new AppError("Faltan 'supervisor_id' y 'pin'", 400);

  const solicitud = await repo.obtenerPorId(id);
  if (!solicitud) throw new AppError("Solicitud no encontrada", 404, { id });
  if (solicitud.estado !== "PENDIENTE") {
    throw new AppError(`La solicitud ya está ${solicitud.estado}`, 409, { estado: solicitud.estado });
  }

  const supervisor = await validarSupervisor({ supervisor_id, pin });

  // TDSI-469: al aprobar, se abre el turno con los datos de la solicitud.
  const turno = await abrirTurno({
    caja_id: solicitud.caja_id,
    cajero_id: solicitud.cajero_id,
    efectivo_inicial: solicitud.efectivo_inicial,
    autorizadoPor: supervisor,  // ← flag para saltar la validación duplicada
  });

  const autorizacion = await repo.marcarAprobada(id, {
    autorizado_por: supervisor.supervisor_id,
    autorizado_por_nombre: supervisor.nombre,
    turno_id: turno.id,
  });

  return { autorizacion, turno };
}

/** TDSI-468/604: el supervisor rechaza la solicitud con motivo obligatorio. */
async function rechazarSolicitud(id, { supervisor_id, pin, motivo_rechazo }) {
  if (!supervisor_id || !pin) throw new AppError("Faltan 'supervisor_id' y 'pin'", 400);
  if (!motivo_rechazo || !motivo_rechazo.trim()) {
    throw new AppError("El motivo de rechazo es obligatorio", 400);
  }

  const solicitud = await repo.obtenerPorId(id);
  if (!solicitud) throw new AppError("Solicitud no encontrada", 404, { id });
  if (solicitud.estado !== "PENDIENTE") {
    throw new AppError(`La solicitud ya está ${solicitud.estado}`, 409, { estado: solicitud.estado });
  }

  const supervisor = await validarSupervisor({ supervisor_id, pin });

  return repo.marcarRechazada(id, {
    autorizado_por: supervisor.supervisor_id,
    autorizado_por_nombre: supervisor.nombre,
    motivo_rechazo: motivo_rechazo.trim(),
  });
}

module.exports = { solicitarApertura, listarPendientes, aprobarSolicitud, rechazarSolicitud };