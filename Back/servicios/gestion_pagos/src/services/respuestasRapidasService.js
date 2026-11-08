const { AppError } = require("../utils/AppError");
const repo = require("../data/respuestasRapidasRepo");

const MAXIMO_POR_CAJERO = 8;

/** TDSI-799: Lista las respuestas rápidas de un cajero. */
async function listar(cajero_id) {
  if (!cajero_id) throw new AppError("Falta el campo 'cajero_id'.", 400);
  return repo.listarPorCajero(cajero_id);
}

/** TDSI-800: Crea una respuesta rápida validando el texto (5 a 100 caracteres) y el máximo de 8 por cajero. */
async function crear({ cajero_id, texto, orden }) {
  if (!cajero_id) throw new AppError("Falta el campo 'cajero_id'.", 400);
  if (!texto || typeof texto !== "string" || texto.trim().length < 5 || texto.trim().length > 100) {
    throw new AppError("El texto debe tener entre 5 y 100 caracteres.", 400);
  }
  const actuales = await repo.contarPorCajero(cajero_id);
  if (actuales >= MAXIMO_POR_CAJERO) {
    throw new AppError(`Ya tienes el máximo de ${MAXIMO_POR_CAJERO} respuestas rápidas. Elimina una para crear otra.`, 409);
  }
  return repo.crear({ cajero_id, texto: texto.trim(), orden });
}

/** TDSI-800: Edita una respuesta rápida validando que sea del mismo cajero. */
async function actualizar(id, cajero_id, { texto }) {
  if (!cajero_id) throw new AppError("Falta el campo 'cajero_id'.", 400);
  if (!texto || typeof texto !== "string" || texto.trim().length < 5 || texto.trim().length > 100) {
    throw new AppError("El texto debe tener entre 5 y 100 caracteres.", 400);
  }
  const existente = await repo.obtenerPorId(id);
  if (!existente) throw new AppError("Respuesta rápida no encontrada.", 404);
  if (existente.cajero_id !== cajero_id) {
    throw new AppError("No tienes permiso para editar esta respuesta.", 403);
  }
  return repo.actualizar(id, cajero_id, { texto: texto.trim() });
}

/** TDSI-801: Elimina una respuesta rápida solo si es del mismo cajero. */
async function eliminar(id, cajero_id) {
  if (!cajero_id) throw new AppError("Falta el campo 'cajero_id'.", 400);
  const existente = await repo.obtenerPorId(id);
  if (!existente) throw new AppError("Respuesta rápida no encontrada.", 404);
  if (existente.cajero_id !== cajero_id) {
    throw new AppError("No tienes permiso para eliminar esta respuesta.", 403);
  }
  await repo.eliminar(id, cajero_id);
  return { eliminado: true };
}

module.exports = { listar, crear, actualizar, eliminar };