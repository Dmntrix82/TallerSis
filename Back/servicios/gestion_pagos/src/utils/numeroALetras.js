const UNIDADES = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
const DECENAS_10_19 = ["diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve"];
const DECENAS = ["", "", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const CENTENAS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];

function tresDigitosALetras(n) {
  if (n === 0) return "";
  if (n === 100) return "cien";

  const c = Math.floor(n / 100);
  const resto = n % 100;
  let texto = c > 0 ? CENTENAS[c] : "";

  if (resto > 0) {
    if (texto) texto += " ";
    if (resto < 10) {
      texto += UNIDADES[resto];
    } else if (resto < 20) {
      texto += DECENAS_10_19[resto - 10];
    } else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      texto += DECENAS[d];
      if (u > 0) texto += (d === 2 ? "i" : " y ") + UNIDADES[u];
    }
  }
  return texto;
}

function grupoALetras(n, singular, plural) {
  if (n === 0) return "";
  const texto = n === 1 ? "un" : tresDigitosALetras(n);
  const etiqueta = n === 1 ? singular : plural;
  return `${texto} ${etiqueta}`;
}

/** Convierte un entero (parte de bolivianos, sin centavos) a letras en español. Soporta hasta 999,999,999. */
function enteroALetras(n) {
  if (n === 0) return "cero";

  const millones = Math.floor(n / 1000000);
  const miles = Math.floor((n % 1000000) / 1000);
  const resto = n % 1000;

  const partes = [];
  if (millones > 0) partes.push(grupoALetras(millones, "millón", "millones"));
  if (miles > 0) partes.push(miles === 1 ? "mil" : `${tresDigitosALetras(miles)} mil`);
  if (resto > 0) partes.push(tresDigitosALetras(resto));

  return partes.join(" ").trim();
}

/** TDSI-303: "Son: <monto en letras> bolivianos" para el pie de la factura impresa/PDF. */
function montoEnLetras(monto) {
  const num = Number(monto) || 0;
  const entero = Math.floor(num);
  const centavos = Math.round((num - entero) * 100);

  const parteEntera = enteroALetras(entero).toUpperCase();
  const parteCentavos = String(centavos).padStart(2, "0");

  return `${parteEntera} ${entero === 1 ? "BOLIVIANO" : "BOLIVIANOS"} CON ${parteCentavos}/100`;
}

module.exports = { montoEnLetras };
