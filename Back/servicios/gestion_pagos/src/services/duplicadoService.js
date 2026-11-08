const { AppError } = require("../utils/AppError");
const repo = require("../data/pagosRepo");

/**
 * TDSI-163/825: Busca si el mismo cajero ya cobró el mismo monto al mismo NIT/CI
 * en los últimos 2 minutos (120 segundos). Excluye ventas anuladas.
 * Devuelve el número de factura y los segundos transcurridos del cobro encontrado.
 */
async function detectarPosibleDuplicado({ cajero_id, nit, total, segundos_ventana = 120 }) {
  if (!cajero_id) {
    throw new AppError("Falta el campo 'cajero_id'.", 400);
  }
  if (!nit) {
    throw new AppError("Falta el campo 'nit'.", 400);
  }
  if (!Number.isFinite(total) || total <= 0) {
    throw new AppError("El 'total' debe ser un número mayor a 0.", 400);
  }

  const duplicado = await repo.buscarPosibleDuplicado({ cajero_id, nit, total, segundos_ventana });

  if (!duplicado) {
    return { esDuplicado: false };
  }

  return {
    esDuplicado: true,
    factura: duplicado.id_transaccion,
    segundos: duplicado.segundos,
  };
}

module.exports = { detectarPosibleDuplicado };