const test = require("node:test");
const assert = require("node:assert/strict");
const { query, pool } = require("../config/db");
const { generarTirilla } = require("../services/tirillaService");
const { crearFactura } = require("../services/facturasService");

// Factura propia de esta prueba: antes el archivo asumia que "F-000001" ya
// existia (cargada a mano) en la base real, y esa suposicion se rompio cuando
// esa factura dejo de existir en el ambiente compartido.
const SUFIJO = String(Date.now()).slice(-8);
const NIT = `4${SUFIJO}`;
let numero;

test.before(async () => {
  const factura = await crearFactura({
    nit: NIT,
    razon_social: "Juan Perez",
    items: [{ descripcion: "Arroz 1kg", cantidad: 1, precio_unitario: 35 }],
  });
  numero = factura.numero;
});

test.after(async () => {
  await query(`DELETE FROM facturacion.impresiones WHERE factura_numero = $1`, [numero]);
  await query(`DELETE FROM facturacion.facturas WHERE numero = $1`, [numero]);
  await query(`DELETE FROM facturacion.clientes_frecuentes WHERE nit = $1`, [NIT]);
  await pool.end();
});

test("TDSI-93/295: la tirilla respeta el ancho de 40 y trae el total", async () => {
  const t = await generarTirilla(numero);
  assert.ok(t.lineas.every((l) => l.length <= 40));
  assert.match(t.texto, /TOTAL Bs\s+35\.00/);
});

test("TDSI-295: la tirilla incluye datos de sucursal, cliente e items", async () => {
  const t = await generarTirilla(numero);
  assert.match(t.texto, /Sucursal Central/);
  assert.match(t.texto, /Juan Perez/);
  assert.match(t.texto, /Arroz 1kg/);
});
