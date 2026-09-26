const lotesCierreRepo = require("../data/lotesCierreRepo");

/** TDSI-401: actualiza el saldo/flujo del dia (total_egresos) tras registrar un egreso */
async function actualizarFlujoTrasEgreso(monto) {
  return lotesCierreRepo.sumarEgresoDelDia(monto);
}

module.exports = { actualizarFlujoTrasEgreso };
