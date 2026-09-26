const aCentavos = (v) => Math.round(Number(v) * 100);
const aMonto = (c) => Number((c / 100).toFixed(2));

module.exports = { aCentavos, aMonto };