const { AppError } = require("../utils/AppError");
const repo = require("../data/ventasCanceladasRepo");

const MOTIVOS_VALIDOS = [
  'El cliente desistió',
  'Fondos insuficientes',
  'Error al cargar ítems',
  'Otro'
];

/** TDSI-838: Registra una venta cancelada validando el motivo. NO crea transacción en BD. */
async function registrar({ cajero_id, caja_id, turno_id, items, total, motivo, motivo_texto }) {
  if (!cajero_id) throw new AppError("Falta el campo 'cajero_id'.", 400);
  if (!Array.isArray(items) || items.length === 0) throw new AppError("La venta debe tener al menos 1 ítem.", 400);
  if (!Number.isFinite(total) || total < 0) throw new AppError("El total debe ser un número mayor o igual a 0.", 400);
  
  if (!MOTIVOS_VALIDOS.includes(motivo)) {
    throw new AppError(`Motivo inválido. Debe ser uno de: ${MOTIVOS_VALIDOS.join(", ")}`, 400);
  }
  
  if (motivo === 'Otro' && (!motivo_texto || motivo_texto.trim() === "")) {
    throw new AppError("Si elige 'Otro', debe especificar el motivo en el texto.", 400);
  }

  return repo.registrar({ 
    cajero_id, caja_id, turno_id, items, total, motivo, 
    motivo_texto: motivo === 'Otro' ? motivo_texto.trim() : null 
  });
}

/** TDSI-839: Obtiene el conteo de ventas canceladas hoy por el cajero. */
async function obtenerConteoHoy(cajero_id, fecha = null) {
  if (!cajero_id) throw new AppError("Falta el campo 'cajero_id'.", 400);
  const total = await repo.contarHoy(cajero_id, fecha);
  return { total };
}

module.exports = { registrar, obtenerConteoHoy };