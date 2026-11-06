// En facturacion no existe un AppError custom, usamos el Error nativo con status
const crearError = (mensaje, status) => {
  const e = new Error(mensaje);
  e.status = status;
  return e;
};

const repo = require("../data/respuestasAnulacionRepo");

/** TDSI-890: Listar. */
async function listar(cajero_id) {
  if (!cajero_id) throw crearError("Falta 'cajero_id'.", 400);
  return repo.listarPorCajero(cajero_id);
}

/** TDSI-891: Crear (con validación de 10 a 300 caracteres). */
async function crear({ cajero_id, texto, orden }) {
  if (!cajero_id) throw crearError("Falta 'cajero_id'.", 400);
  if (!texto || texto.trim().length < 10 || texto.trim().length > 300) {
    throw crearError("El texto debe tener entre 10 y 300 caracteres.", 400);
  }
  return repo.crear({ cajero_id, texto: texto.trim(), orden });
}

/** TDSI-891: Editar. */
async function actualizar(id, cajero_id, { texto }) {
  if (!cajero_id) throw crearError("Falta 'cajero_id'.", 400);
  if (!texto || texto.trim().length < 10 || texto.trim().length > 300) {
    throw crearError("El texto debe tener entre 10 y 300 caracteres.", 400);
  }
  const existente = await repo.obtenerPorId(id);
  if (!existente) throw crearError("Respuesta no encontrada.", 404);
  if (existente.cajero_id !== cajero_id) {
    throw crearError("No tienes permiso para editar esta respuesta.", 403);
  }
  return repo.actualizar(id, cajero_id, { texto: texto.trim() });
}

/** TDSI-892: Eliminar. */
async function eliminar(id, cajero_id) {
  if (!cajero_id) throw crearError("Falta 'cajero_id'.", 400);
  const existente = await repo.obtenerPorId(id);
  if (!existente) throw crearError("Respuesta no encontrada.", 404);
  if (existente.cajero_id !== cajero_id) {
    throw crearError("No tienes permiso para eliminar esta respuesta.", 403);
  }
  await repo.eliminar(id, cajero_id);
  return { eliminado: true };
}

module.exports = { listar, crear, actualizar, eliminar };