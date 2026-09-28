const { AppError } = require("../utils/AppError");
const repo = require("../data/ordenesPagoRepo");

// TDSI-394: el administrador consulta las notificaciones de ordenes nuevas
async function listarNotificaciones({ incluirLeidas } = {}) {
  const lista = await repo.listarNotificaciones({ incluirLeidas: incluirLeidas === true || incluirLeidas === "true" });
  return { total: lista.length, notificaciones: lista };
}

// TDSI-394: marcar como leida es repetible sin problema (si ya estaba leida, sigue leida)
async function marcarNotificacionLeida(id) {
  if (!/^\d+$/.test(String(id)) || !Number.isSafeInteger(Number(id))) {
    throw new AppError("El id de la notificacion debe ser un numero entero positivo", 400, { id });
  }
  const notificacion = await repo.marcarNotificacionLeida(Number(id));
  if (!notificacion) throw new AppError("Notificacion no encontrada", 404, { id });
  return notificacion;
}

module.exports = { listarNotificaciones, marcarNotificacionLeida };
