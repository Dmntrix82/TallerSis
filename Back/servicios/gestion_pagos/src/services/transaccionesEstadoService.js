const { AppError } = require("../utils/AppError");
const repo = require("../data/transaccionesEstadoRepo");
const { esEstadoValido, puedeCambiar } = require("../constants/estadosTransaccion");

// TDSI-362: cache corto para consultas repetidas (polling del Sistema Cliente).
// Se invalida al cambiar el estado, asi nunca devuelve un valor viejo.
const cache = new Map();
const TTL_MS = 5000;
const MAX_CACHE = 500;

function validarId(id) {
  const limpio = String(id ?? "").trim();
  if (!/^[A-Za-z0-9_-]{1,60}$/.test(limpio))
    throw new AppError("El id de la transacción no tiene un formato válido", 400, { id });
  return limpio;
}

function formatear(t) {
  return {
    id: Number(t.id),
    id_transaccion: t.id_transaccion,
    estado_pago: t.estado_pago,
    actualizado_en: t.actualizado_en,
  };
}

/** TDSI-359: consultar el estado actual */
async function consultarEstado(id) {
  const txId = validarId(id);

  const enCache = cache.get(txId);
  if (enCache && enCache.expira > Date.now()) return enCache.data;

  const t = await repo.obtenerEstado(txId);
  if (!t) throw new AppError("Transacción no encontrada", 404, { id: txId });

  const data = formatear(t);
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
  cache.set(txId, { data, expira: Date.now() + TTL_MS });
  return data;
}

/** TDSI-360: actualizar el estado_pago segun el resultado del cobro */
async function actualizarEstado(id, { estado, motivo, origen } = {}) {
  const txId = validarId(id);
  const nuevo = typeof estado === "string" ? estado.trim().toUpperCase() : "";

  if (!esEstadoValido(nuevo))
    throw new AppError("El estado debe ser PENDIENTE, APROBADA o RECHAZADA", 400, { estado });
  if (motivo != null && (typeof motivo !== "string" || motivo.length > 200))
    throw new AppError("El motivo debe ser texto de máximo 200 caracteres", 400);

  const r = await repo.cambiarEstado(
    txId,
    nuevo,
    (actual) => {
      if (!actual) throw new AppError("Transacción no encontrada", 404, { id: txId });
      if (!puedeCambiar(actual.estado_pago, nuevo))
        throw new AppError(
          `No se puede cambiar una transacción de ${actual.estado_pago} a ${nuevo}`,
          409,
          { estado_actual: actual.estado_pago, estado_solicitado: nuevo }
        );
    },
    { motivo: motivo?.trim() || null, origen: origen || "SISTEMA" }
  );

  cache.delete(txId);
  return { ...formatear(r.transaccion), estado_anterior: r.anterior };
}

/** TDSI-361: consultar historial */
async function consultarHistorial(id) {
  const txId = validarId(id);
  if (!(await repo.obtenerEstado(txId)))
    throw new AppError("Transacción no encontrada", 404, { id: txId });
  return repo.obtenerHistorial(txId);
}

module.exports = { consultarEstado, actualizarEstado, consultarHistorial };