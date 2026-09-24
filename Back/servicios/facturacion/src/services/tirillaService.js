const { db } = require("../data/memoria");

const ANCHO = 40;
const linea = (c = "-") => c.repeat(ANCHO);
const centrar = (t) => {
  const s = String(t).slice(0, ANCHO);
  const pad = Math.max(0, Math.floor((ANCHO - s.length) / 2));
  return " ".repeat(pad) + s;
};
const dosColumnas = (izq, der) => {
  const i = String(izq), d = String(der);
  const espacio = Math.max(1, ANCHO - i.length - d.length);
  return i + " ".repeat(espacio) + d;
};
const money = (n) => Number(n).toFixed(2);

function obtenerFactura(numero) {
  const f = db.facturas.find((x) => x.numero === numero);
  if (!f) { const e = new Error("Factura no encontrada"); e.status = 404; throw e; }
  return f;
}

/** TDSI-93 / TDSI-295: genera el formato de impresión tipo tirilla/rollo. */
function generarTirilla(numero, { copia = false } = {}) {
  const f = obtenerFactura(numero);
  const L = [];

  L.push(centrar(f.sucursal.nombre));
  L.push(centrar(f.sucursal.direccion));
  L.push(centrar("Tel: " + f.sucursal.telefono));
  L.push(linea("="));
  L.push(centrar("FACTURA " + f.numero));
  if (copia) L.push(centrar("*** COPIA / REIMPRESION ***"));
  L.push(linea("="));
  L.push(dosColumnas("Fecha:", new Date(f.fecha).toLocaleString("es-BO")));
  L.push(dosColumnas("Cliente:", f.cliente.nombre));
  L.push(dosColumnas("NIT/CI:", f.cliente.nit));
  L.push(linea());
  L.push(dosColumnas("DESCRIPCION", "IMPORTE"));
  L.push(linea());

  for (const it of f.items) {
    L.push(String(it.descripcion).slice(0, ANCHO));
    L.push(dosColumnas(`  ${it.cantidad} x ${money(it.precioUnitario)}`, money(it.subtotal)));
  }

  L.push(linea());
  L.push(dosColumnas("SUBTOTAL", money(f.subtotal)));
  if (f.descuento) L.push(dosColumnas("DESCUENTO", "-" + money(f.descuento)));
  L.push(dosColumnas("IVA (13%)", money(f.impuesto)));
  L.push(dosColumnas("TOTAL Bs", money(f.total)));
  L.push(linea());

  for (const m of f.metodosPago) L.push(dosColumnas("  " + m.metodo, money(m.monto)));

  L.push(linea("="));
  L.push(centrar("Gracias por su compra"));
  L.push("");

  return { numero: f.numero, ancho: ANCHO, copia, lineas: L, texto: L.join("\n") };
}

module.exports = { generarTirilla, obtenerFactura };