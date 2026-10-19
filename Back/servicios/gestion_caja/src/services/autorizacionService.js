const { AppError } = require("../utils/AppError");
const repo = require("../data/autorizacionesRepo");
const turnosRepo = require("../data/turnosRepo");
const { validarSupervisor } = require("./supervisorProxy");
const { abrirTurno } = require("./turnosService");
const { cerrarTurno } = require("./cierreService");

/** TDSI-471: el cajero solicita cerrar el turno. */
async function solicitarCierre({ turno_id, cajero_id, cajero_nombre, efectivo_contado }) {
  if (!turno_id || !cajero_id) throw new AppError("Faltan 'turno_id' o 'cajero_id'", 400);
  if (efectivo_contado === undefined || efectivo_contado === null) {
    throw new AppError("Falta 'efectivo_contado'", 400);
  }
  const monto = Number(efectivo_contado);
  if (Number.isNaN(monto) || monto < 0) {
    throw new AppError("El efectivo contado debe ser un número >= 0", 400);
  }

  const turno = await turnosRepo.obtenerTurnoPorId(turno_id);
  if (!turno) throw new AppError("Turno no encontrado", 404, { turno_id });
  if (turno.estado === "CERRADO") {
    throw new AppError("El turno ya está cerrado", 409, { turno_id });
  }

  const pendiente = await repo.buscarPendientePorTurno(turno_id);
  if (pendiente) {
    throw new AppError("Ya hay una solicitud de cierre pendiente para ese turno", 409, { solicitud_id: pendiente.id });
  }

  return repo.crearSolicitudCierre({
    caja_id: turno.caja_id,
    turno_id,
    cajero_id,
    cajero_nombre,
    efectivo_contado: monto,
  });
}

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

  // TDSI-469: APERTURA → abrir turno
  // TDSI-473: CIERRE → cerrar turno
  let turno;
  if (solicitud.tipo === "CIERRE") {
    // TDSI-473/487: con el efectivo que declaro el cajero se guarda el arqueo en el turno
    // y, si hay faltante o sobrante, queda registrada la diferencia (TDSI-32).
    const resultado = await cerrarTurno(solicitud.turno_id, {
      supervisor_id,
      pin,
      efectivo_contado: solicitud.efectivo_contado,
    });
    turno = resultado.turno;
  } else {
    turno = await abrirTurno({
      caja_id: solicitud.caja_id,
      cajero_id: solicitud.cajero_id,
      efectivo_inicial: solicitud.efectivo_inicial,
      autorizadoPor: supervisor,
    });
  }

  const autorizacion = await repo.marcarAprobada(id, {
    autorizado_por: supervisor.supervisor_id,
    autorizado_por_nombre: supervisor.nombre,
    turno_id: turno.id || solicitud.turno_id,
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

module.exports = { solicitarApertura, solicitarCierre, listarPendientes, aprobarSolicitud, rechazarSolicitud };