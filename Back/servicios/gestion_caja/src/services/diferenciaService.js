const { AppError } = require("../utils/AppError");
const repo = require("../data/diferenciasRepo");

/** TDSI-489: Listar diferencias */
async function listar({ estado, tipo, caja_id }) {
  if (estado && !["PENDIENTE", "RESUELTA"].includes(estado)) {
    throw new AppError("El 'estado' debe ser PENDIENTE o RESUELTA", 400);
  }
  if (tipo && !["FALTANTE", "SOBRANTE"].includes(tipo)) {
    throw new AppError("El 'tipo' debe ser FALTANTE o SOBRANTE", 400);
  }
  return repo.listar({ estado, tipo, caja_id });
}

/** TDSI-488: Resolver una diferencia con justificación obligatoria */
async function resolver(id, { justificacion, resuelta_por } = {}) {
  if (!/^\d+$/.test(String(id))) throw new AppError("Id de diferencia inválido", 400, { id });
  if (typeof justificacion !== "string" || !justificacion.trim()) {
    throw new AppError("La 'justificacion' es obligatoria", 400);
  }
  if (typeof resuelta_por !== "string" || !resuelta_por.trim()) {
    throw new AppError("El campo 'resuelta_por' es obligatorio", 400);
  }

  const existe = await repo.obtenerPorId(id);
  if (!existe) throw new AppError("Diferencia no encontrada", 404, { id });
  if (existe.estado === "RESUELTA") {
    throw new AppError("Esta diferencia ya fue resuelta", 409);
  }

  return repo.resolver(id, { justificacion: justificacion.trim(), resuelta_por: resuelta_por.trim() });
}

module.exports = { listar, resolver };
