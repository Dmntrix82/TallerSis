// TDSI-61/199: al presionar "Cobrar" se guarda el nombre del cajero que inicio
// sesion (no solo caja_id/cajero_id, que ya existian) para poder mostrar despues
// "Atendido por" en la factura. BD real; limpia lo que crea.
const test = require("node:test");
const assert = require("node:assert/strict");
const { registrarPagoSimple } = require("../services/pagoSimpleService");
const { registrarPagoMixto } = require("../services/pagoMixtoService");
const { listarMisFacturas } = require("../services/ventasCajeroService");
const { construirFacturaDigital } = require("../services/facturaDigitalService");
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
