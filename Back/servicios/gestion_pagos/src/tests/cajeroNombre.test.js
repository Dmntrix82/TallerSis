// TDSI-61/199: al presionar "Cobrar" se guarda el nombre del cajero que inicio
// sesion (no solo caja_id/cajero_id, que ya existian) para poder mostrar despues
// "Atendido por" en la factura. BD real; limpia lo que crea.
const test = require("node:test");
const assert = require("node:assert/strict");
const { registrarPagoSimple } = require("../services/pagoSimpleService");
const { registrarPagoMixto } = require("../services/pagoMixtoService");
const { listarMisFacturas } = require("../services/ventasCajeroService");
const { construirFacturaDigital } = require("../services/facturaDigitalService");
const { generarFacturaPdfBuffer } = require("../services/facturaPdfService");
const { renderizarHtmlFactura } = require("../services/emailService");
const { lineaAtendidoPor } = require("../utils/atendidoPor");
const { obtenerFacturaPorToken, obtenerOCrearToken } = require("../services/verificacionFacturaService");
const { query } = require("../config/db");

const PREFIJO = `TX-CAJERONOMBRE-${Date.now()}`;
const CAJERO_EMAIL = `cajero-${Date.now()}@test.com`;

const idsSimpleGenerados = [];

test.after(async () => {
  await query(`DELETE FROM pagos.pagos_mixtos WHERE id_transaccion LIKE $1`, [`${PREFIJO}%`]);
  await query(`DELETE FROM pagos.transacciones WHERE id_transaccion LIKE $1`, [`${PREFIJO}%`]);
  await query(`DELETE FROM pagos.transacciones WHERE cajero = $1`, [CAJERO_EMAIL]);
  if (idsSimpleGenerados.length) {
    await query(`DELETE FROM pagos.transacciones WHERE id_transaccion = ANY($1)`, [idsSimpleGenerados]);
  }
});

test("TDSI-199: pago simple guarda el nombre del cajero logueado", async () => {
  const r = await registrarPagoSimple({
    metodo: "QR", monto: 50,
    caja_id: "CAJA-1", turno_id: "TUR-1", cajero_id: "uuid-cajero-1", cajero_nombre: "Juana Perez",
  });
  idsSimpleGenerados.push(r.pago.id_transaccion);
  const { rows } = await query(`SELECT caja_id, cajero_nombre FROM pagos.transacciones WHERE id_transaccion = $1`, [r.pago.id_transaccion]);
  assert.equal(rows[0].caja_id, "CAJA-1");
  assert.equal(rows[0].cajero_nombre, "Juana Perez");
});

test("TDSI-199: pago simple sin nombre de cajero no rompe (queda null)", async () => {
  const r = await registrarPagoSimple({ metodo: "Efectivo", monto: 20 });
  idsSimpleGenerados.push(r.pago.id_transaccion);
  const { rows } = await query(`SELECT cajero_nombre FROM pagos.transacciones WHERE id_transaccion = $1`, [r.pago.id_transaccion]);
  assert.equal(rows[0].cajero_nombre, null);
});

test("TDSI-199: pago mixto guarda el nombre del cajero en sus transacciones", async () => {
  const id = `${PREFIJO}-MIXTO-1`;
  await registrarPagoMixto({
    id_transaccion: id, cajaId: "CAJA-2", turnoId: "TUR-2", total: 100,
    metodos: [{ metodo: "Efectivo", monto: 40 }, { metodo: "QR", monto: 60 }],
    cajeroId: "uuid-cajero-2", cajeroNombre: "Marco Soliz",
  });
  const { rows } = await query(`SELECT cajero_nombre FROM pagos.transacciones WHERE id_transaccion = $1`, [id]);
  assert.equal(rows.length, 2);
  assert.ok(rows.every((r) => r.cajero_nombre === "Marco Soliz"));
});

test("TDSI-199: pago mixto acepta cajero_nombre en snake_case tambien", async () => {
  const id = `${PREFIJO}-MIXTO-2`;
  await registrarPagoMixto({
    id_transaccion: id, cajaId: "CAJA-2", turnoId: "TUR-2", total: 100,
    metodos: [{ metodo: "Efectivo", monto: 40 }, { metodo: "QR", monto: 60 }],
    cajero_id: "uuid-cajero-3", cajero_nombre: "Rosa Mamani",
  });
  const { rows } = await query(`SELECT cajero_nombre FROM pagos.transacciones WHERE id_transaccion = $1`, [id]);
  assert.ok(rows.every((r) => r.cajero_nombre === "Rosa Mamani"));
});

// TDSI-943 (adaptado a pagos.transacciones: TDSI-61 es ventas de la pantalla Pagos,
// que nunca tocan facturacion.facturas -- ver AskUserQuestion de la conversacion).
test("TDSI-943: el listado de facturas del cajero (mis-facturas) incluye su nombre", async () => {
  const r = await registrarPagoSimple({
    metodo: "Efectivo", monto: 15, caja_id: "CAJA-943",
    cajero: CAJERO_EMAIL, cajero_id: "uuid-943", cajero_nombre: "Pedro Villca",
  });
  idsSimpleGenerados.push(r.pago.id_transaccion);

  const lista = await listarMisFacturas(CAJERO_EMAIL);
  const fila = lista.find((f) => f.id_transaccion === r.pago.id_transaccion);
  assert.ok(fila, "la venta debe aparecer en el listado");
  assert.equal(fila.caja_id, "CAJA-943");
  assert.equal(fila.cajero_nombre, "Pedro Villca");
});

test("TDSI-943: una venta sin cajero_nombre (anterior a TDSI-199) aparece como 'no registrado'", async () => {
  const r = await registrarPagoSimple({ metodo: "Efectivo", monto: 15, cajero: CAJERO_EMAIL });
  idsSimpleGenerados.push(r.pago.id_transaccion);

  const lista = await listarMisFacturas(CAJERO_EMAIL);
  const fila = lista.find((f) => f.id_transaccion === r.pago.id_transaccion);
  assert.equal(fila.cajero_nombre, "no registrado");
});

test("TDSI-943: la factura digital (PDF/correo) devuelve el nombre del cajero", async () => {
  const r = await registrarPagoSimple({
    metodo: "QR", monto: 70, caja_id: "CAJA-943B", cajero_nombre: "Elena Quispe",
  });
  idsSimpleGenerados.push(r.pago.id_transaccion);

  const factura = await construirFacturaDigital(r.pago.id_transaccion);
  assert.equal(factura.comprobante.caja_id, "CAJA-943B");
  assert.equal(factura.comprobante.cajero_nombre, "Elena Quispe");
});

test("TDSI-943: la factura digital de una venta antigua devuelve 'no registrado'", async () => {
  const r = await registrarPagoSimple({ metodo: "QR", monto: 70 });
  idsSimpleGenerados.push(r.pago.id_transaccion);

  const factura = await construirFacturaDigital(r.pago.id_transaccion);
  assert.equal(factura.comprobante.cajero_nombre, "no registrado");
});

// TDSI-944
test("TDSI-944: lineaAtendidoPor combina nombre y caja", () => {
  assert.equal(
    lineaAtendidoPor({ cajero_nombre: "Juana Perez", caja_id: "CAJA-1" }),
    "Atendido por: Juana Perez · Caja N° CAJA-1"
  );
});

test("TDSI-944: lineaAtendidoPor sin caja (venta muy antigua) omite esa parte", () => {
  assert.equal(
    lineaAtendidoPor({ cajero_nombre: "no registrado", caja_id: null }),
    "Atendido por: no registrado"
  );
});

test("TDSI-944: el correo de la factura incluye la linea Atendido por", () => {
  const factura = {
    empresa: { nombre: "TallerSis", direccion: "Av. Principal s/n, Bolivia" },
    comprobante: { id_transaccion: "VTA-000001", fecha: new Date().toISOString(), cajero_nombre: "Juana Perez", caja_id: "CAJA-1" },
    cliente: { razon_social: "Consumidor final", nit: null },
    pagos: [{ metodo: "QR", monto: 50 }],
    total: 50,
  };
  const html = renderizarHtmlFactura(factura);
  assert.ok(html.includes("Atendido por: Juana Perez · Caja N° CAJA-1"));
});

test("TDSI-944: el PDF de la factura se genera sin romperse con el nombre del cajero", async () => {
  const r = await registrarPagoSimple({ metodo: "QR", monto: 90, caja_id: "CAJA-944", cajero_nombre: "Luis Ticona" });
  idsSimpleGenerados.push(r.pago.id_transaccion);

  const factura = await construirFacturaDigital(r.pago.id_transaccion);
  const pdfBuffer = await generarFacturaPdfBuffer(factura);
  assert.ok(Buffer.isBuffer(pdfBuffer));
  assert.equal(pdfBuffer.subarray(0, 4).toString(), "%PDF");
});

// TDSI-945
test("TDSI-945: la verificacion por QR incluye el nombre del cajero y la caja", async () => {
  const r = await registrarPagoSimple({ metodo: "Tarjeta", monto: 25, caja_id: "CAJA-945", cajero_nombre: "Carla Flores" });
  idsSimpleGenerados.push(r.pago.id_transaccion);

  const token = await obtenerOCrearToken(r.pago.id_transaccion);
  const data = await obtenerFacturaPorToken(token);
  assert.equal(data.caja_id, "CAJA-945");
  assert.equal(data.cajero_nombre, "Carla Flores");
  assert.equal(data.atendido_por, "Atendido por: Carla Flores · Caja N° CAJA-945");
});

test("TDSI-945: una venta antigua sin cajero_nombre se verifica como 'no registrado'", async () => {
  const r = await registrarPagoSimple({ metodo: "Tarjeta", monto: 25 });
  idsSimpleGenerados.push(r.pago.id_transaccion);

  const token = await obtenerOCrearToken(r.pago.id_transaccion);
  const data = await obtenerFacturaPorToken(token);
  assert.equal(data.cajero_nombre, "no registrado");
  assert.equal(data.atendido_por, "Atendido por: no registrado");
});

test("TDSI-945: la verificacion por QR no expone el email del cajero", async () => {
  const r = await registrarPagoSimple({ metodo: "Tarjeta", monto: 25, cajero: CAJERO_EMAIL, cajero_nombre: "Hugo Rocha" });
  idsSimpleGenerados.push(r.pago.id_transaccion);

  const token = await obtenerOCrearToken(r.pago.id_transaccion);
  const data = await obtenerFacturaPorToken(token);
  assert.equal(data.cajero, undefined);
  assert.equal(data.cajero_id, undefined);
});
