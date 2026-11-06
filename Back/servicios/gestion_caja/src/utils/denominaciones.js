// TDSI-60: billetes y monedas de Bs que se cuentan en el arqueo de efectivo, de mayor
// a menor (los mismos valores que acepta caja.arqueo_denominaciones).
const DENOMINACIONES = [
  { valor: 200, tipo: "BILLETE" },
  { valor: 100, tipo: "BILLETE" },
  { valor: 50, tipo: "BILLETE" },
  { valor: 20, tipo: "BILLETE" },
  { valor: 10, tipo: "BILLETE" },
  { valor: 5, tipo: "MONEDA" },
  { valor: 2, tipo: "MONEDA" },
  { valor: 1, tipo: "MONEDA" },
  { valor: 0.5, tipo: "MONEDA" },
  { valor: 0.2, tipo: "MONEDA" },
  { valor: 0.1, tipo: "MONEDA" },
];

const tipoDe = (valor) => DENOMINACIONES.find((d) => d.valor === Number(valor))?.tipo || null;

module.exports = { DENOMINACIONES, tipoDe };
