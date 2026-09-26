const ESTADOS = Object.freeze({
  PENDIENTE: "PENDIENTE",
  APROBADA: "APROBADA",
  RECHAZADA: "RECHAZADA",
});

// Solo una transaccion PENDIENTE puede cambiar; APROBADA y RECHAZADA son finales
const TRANSICIONES = Object.freeze({
  PENDIENTE: [ESTADOS.APROBADA, ESTADOS.RECHAZADA],
  APROBADA: [],
  RECHAZADA: [],
});

const esEstadoValido = (estado) => Object.values(ESTADOS).includes(estado);
const puedeCambiar = (de, a) => (TRANSICIONES[de] || []).includes(a);

module.exports = { ESTADOS, esEstadoValido, puedeCambiar };