/**
 * TDSI-29/547: cuanto vuelto hay que entregar cuando el cajero cobra en
 * efectivo. Redondea a 2 decimales para evitar arrastrar errores de punto
 * flotante (ej. 0.1 + 0.2).
 */
function calcularVuelto(total, montoRecibido) {
  return Math.round((montoRecibido - total) * 100) / 100;
}

module.exports = { calcularVuelto };
