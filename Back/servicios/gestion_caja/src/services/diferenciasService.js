const { AppError } = require("../utils/AppError");
const diferenciasRepo = require("../data/diferenciasRepo");
const { armarMensajeDiferencia, publicarDiferencia } = require("./contabilidadService");

/**
 * TDSI-52/698: el Administrador resuelve una diferencia (faltante/sobrante) con su
 * justificacion. La resolucion en nuestro sistema queda firme pase lo que pase con
 * Contabilidad: si Pub/Sub no responde, la diferencia NO se pierde ni queda a medias
 * -- el intento de aviso se informa aparte en la respuesta (el seguimiento formal del
 * envio, con reintentos, es un subtask aparte: TDSI-699/700/701).
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
  const resultado = await publicarDiferencia(mensaje);

  return {
    diferencia: resuelta,
    contabilidad: resultado.ok
      ? { publicado: true, messageId: resultado.messageId }
      : { publicado: false, error: resultado.error },
  };
}

module.exports = { resolverDiferencia };
