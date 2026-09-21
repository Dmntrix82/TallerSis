// Se calcula en centavos (enteros) para evitar errores de punto flotante.
const aCentavos = (v) => Math.round(Number(v) * 100);
const aMonto = (c) => Number((c / 100).toFixed(2));
const porcentaje = (c, totalC) => Number(((c / totalC) * 100).toFixed(2));

module.exports = { aCentavos, aMonto, porcentaje };