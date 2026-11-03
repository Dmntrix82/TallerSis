const { AppError } = require("../utils/AppError");
const diferenciasRepo = require("../data/diferenciasRepo");
const diferenciasEnviosRepo = require("../data/diferenciasEnviosRepo");
const { armarMensajeDiferencia, publicarDiferencia } = require("./contabilidadService");

/**
 * TDSI-52/698: el Administrador resuelve una diferencia (faltante/sobrante) con su
 * justificacion. La resolucion en nuestro sistema queda firme pase lo que pase con
 * Contabilidad: si Pub/Sub no responde, la diferencia NO se pierde ni queda a medias
 * -- el intento queda registrado en caja.diferencias_envios_contabilidad (TDSI-699) para
 * poder reintentarlo despues (TDSI-701) y para que TDSI-700 sepa que envio esperar.
 */
async function resolverDiferencia(id, { justificacion, resuelta_por } = {}) {
  const justificacionLimpia = String(justificacion || "").trim();
  if (!justificacionLimpia) {
    throw new AppError("La justificación es obligatoria para resolver una diferencia.", 400);
  }

  const actual = await diferenciasRepo.obtenerConTurno(id);
  if (!actual) throw new AppError("Diferencia no encontrada", 404, { id });
  if (actual.diferencia.estado !== "PENDIENTE") {
    throw new AppError("Esta diferencia ya fue resuelta.", 409, { id });
  }

  const resuelta = await diferenciasRepo.resolver(id, { justificacion: justificacionLimpia, resuelta_por });
  if (!resuelta) throw new AppError("Esta diferencia ya fue resuelta.", 409, { id });

  const mensaje = armarMensajeDiferencia({ diferencia: resuelta, turno: actual.turno });
  await diferenciasEnviosRepo.crearPendiente(resuelta.id, mensaje);

  const resultado = await publicarDiferencia(mensaje);
  const envio = resultado.ok
    ? await diferenciasEnviosRepo.marcarEnviado(resuelta.id, resultado.messageId)
    : await diferenciasEnviosRepo.marcarError(resuelta.id, resultado.error);

  return {
    diferencia: resuelta,
    contabilidad: resultado.ok
      ? { publicado: true, messageId: resultado.messageId, estado: envio.estado }
      : { publicado: false, error: resultado.error, estado: envio.estado },
  };
}

/** TDSI-52/701: "Diferencias de caja" con el estado del aviso a Contabilidad (columna "Contabilidad" del Front). */
async function listarDiferencias({ estado } = {}) {
  if (estado && !["PENDIENTE", "RESUELTA"].includes(estado)) {
    throw new AppError("El estado debe ser PENDIENTE o RESUELTA.", 400, { estado });
  }
  return diferenciasRepo.listar({ estado });
}

/**
 * TDSI-52/701: boton "Reenviar" -- solo tiene sentido si el envio anterior no llego a
 * buen puerto (nunca se pudo publicar, o Contabilidad lo rechazo). Reusa el mismo
 * mensaje ya armado (el turno/caja/cajero de una diferencia no cambian despues de
 * resuelta), asi que no hace falta reconstruirlo.
 */
async function reenviarContabilidad(id) {
  const envio = await diferenciasEnviosRepo.obtenerPorDiferencia(id);
  if (!envio) throw new AppError("Esta diferencia todavía no tiene un envío a Contabilidad (resuélvela primero).", 404, { id });
  if (!["Pendiente", "Rechazado"].includes(envio.estado)) {
    throw new AppError(`Solo se pueden reenviar envíos con estado Pendiente o Rechazado (este está ${envio.estado}).`, 409, { id, estado: envio.estado });
  }

  const resultado = await publicarDiferencia(envio.payload);
  const actualizado = resultado.ok
    ? await diferenciasEnviosRepo.marcarEnviado(id, resultado.messageId)
    : await diferenciasEnviosRepo.marcarError(id, resultado.error);

  return {
    publicado: resultado.ok,
    ...(resultado.ok ? { messageId: resultado.messageId } : { error: resultado.error }),
    contabilidad: actualizado,
  };
}

module.exports = { resolverDiferencia, listarDiferencias, reenviarContabilidad };
