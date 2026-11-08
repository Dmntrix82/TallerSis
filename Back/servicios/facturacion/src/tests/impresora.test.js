const test = require("node:test");
const assert = require("node:assert/strict");
const { query, pool } = require("../config/db");
const { impresora, estadoImpresora, conmutarImpresora, imprimir, reimprimir } = require("../services/impresoraService");
const { obtenerFactura } = require("../services/tirillaService");
const { crearFactura } = require("../services/facturasService");

// Factura propia de esta prueba: antes el archivo asumia que "F-000001" ya
// existia (cargada a mano) en la base real, y esa suposicion se rompio cuando
// esa factura dejo de existir en el ambiente compartido.
const SUFIJO = String(Date.now()).slice(-8);
const NIT = `3${SUFIJO}`;
let numero;

async function resetFactura() {
  await query(`UPDATE facturacion.facturas SET impresa=false, veces_impresa=0, impresa_en=NULL WHERE numero=$1`, [numero]);
  await query(`DELETE FROM facturacion.impresiones WHERE factura_numero=$1`, [numero]);
}

test.before(async () => {
  const factura = await crearFactura({
    nit: NIT,
    razon_social: "Cliente Prueba Impresora",
    items: [{ descripcion: "Producto", cantidad: 1, precio_unitario: 10 }],
  });
  numero = factura.numero;
});

test.beforeEach(async () => {
  impresora.conectada = true;
  await resetFactura();
});

test.after(async () => {
  await resetFactura();
  await query(`DELETE FROM facturacion.facturas WHERE numero = $1`, [numero]);
  await query(`DELETE FROM facturacion.clientes_frecuentes WHERE nit = $1`, [NIT]);
  await pool.end();
});

test("TDSI-296: la impresora esta conectada por defecto", () => {
  const e = estadoImpresora();
  assert.equal(e.conectada, true);
});

test("TDSI-296: se puede enviar un trabajo de impresion", () => {
  const r = impresora.enviar("hola tirilla");
  assert.match(r.jobId, /^JOB-/);
});

test("TDSI-296: rechaza enviar si la impresora esta desconectada", () => {
  conmutarImpresora(false);
  assert.throws(() => impresora.enviar("texto"), /no conectada/);
});

test("TDSI-296: se puede reconectar la impresora", () => {
  conmutarImpresora(false);
  const e = conmutarImpresora(true);
  assert.equal(e.conectada, true);
});

test("TDSI-297: al imprimir marca la factura como impresa", async () => {
  await imprimir(numero);
  const f = await obtenerFactura(numero);
  assert.equal(f.impresa, true);
});

test("TDSI-297: no permite imprimir dos veces la misma factura", async () => {
  await imprimir(numero);
  await assert.rejects(() => imprimir(numero), /ya fue impresa/);
});

test("TDSI-298: no permite reimprimir si nunca se imprimio antes", async () => {
  await assert.rejects(() => reimprimir(numero), /aun no fue impresa/);
});

test("TDSI-298: reimprime marcando la tirilla como copia", async () => {
  await imprimir(numero);
  const r = await reimprimir(numero, "se dano el papel");
  assert.equal(r.tipo, "COPIA");
  assert.match(r.tirilla, /COPIA \/ REIMPRESION/);
});
