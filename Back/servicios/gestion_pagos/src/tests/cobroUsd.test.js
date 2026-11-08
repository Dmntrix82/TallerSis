const test = require("node:test");
const assert = require("node:assert/strict");
const { calcularCobroUsd } = require("../services/cobroEfectivoService");
const { registrarPagoSimple } = require("../services/pagoSimpleService");
const { construirFacturaDigital } = require("../services/facturaDigitalService");
const { query } = require("../config/db");

const idsCreados = [];

test.after(async () => {
  if (idsCreados.length) {
    await query(`DELETE FROM pagos.transacciones WHERE id_transaccion = ANY($1)`, [idsCreados]);
  }
});

test("TDSI-815: calcula vuelto en Bs cobrando con dólares (con decimales)", async () => {
  // 20 USD * 12 = 240 Bs. Total = 150 Bs. Vuelto = 90 Bs.
  const res = await calcularCobroUsd({ total: 150, dolaresRecibidos: 20 });
  assert.equal(res.totalBs, 150);
  assert.equal(res.tipoCambio, 12);
  assert.equal(res.equivalenteBs, 240);
  assert.equal(res.vuelto, 90);
});

test("TDSI-815: lanza error si los dólares no alcanzan (monto insuficiente)", async () => {
  // 10 USD = 120 Bs. Total = 150 Bs. Faltan 30 Bs.
  await assert.rejects(
    () => calcularCobroUsd({ total: 150, dolaresRecibidos: 10 }),
    (e) => e.status === 400 && e.message.includes("Faltan Bs 30.00")
  );
});

test("TDSI-815: calcula correctamente con centavos (ej. 10.50 USD)", async () => {
  // 10.50 USD * 12 = 126 Bs. Total = 100 Bs. Vuelto = 26 Bs.
  const res = await calcularCobroUsd({ total: 100, dolaresRecibidos: 10.50 });
  assert.equal(res.equivalenteBs, 126);
  assert.equal(res.vuelto, 26);
});

// TDSI-813: registrar un pago en dolares debe guardar la moneda, el monto en
// USD y el tipo de cambio usado -- antes se calculaba (TDSI-812) pero nunca
// se guardaba, asi que la leyenda de la factura (TDSI-814) nunca se veia.
test("TDSI-813: registrar un pago en USD guarda moneda_recibida, monto_usd y tipo_cambio", async () => {
  const r = await registrarPagoSimple({
    metodo: "Efectivo", monto: 150, moneda_recibida: "USD", monto_usd: 20,
  });
  idsCreados.push(r.pago.id_transaccion);

  assert.equal(r.pago.moneda_recibida, "USD");
  assert.equal(r.pago.monto_usd, 20);
  assert.equal(r.pago.tipo_cambio, 12);
  assert.equal(r.pago.monto_recibido, 240); // 20 USD * 12
  assert.equal(r.pago.vuelto, 90); // 240 - 150

  const { rows } = await query(
    `SELECT moneda_recibida, monto_usd, tipo_cambio, monto_recibido, vuelto FROM pagos.transacciones WHERE id_transaccion = $1`,
    [r.pago.id_transaccion]
  );
  assert.equal(rows[0].moneda_recibida, "USD");
  assert.equal(Number(rows[0].monto_usd), 20);
  assert.equal(Number(rows[0].tipo_cambio), 12);
});

test("TDSI-813: nunca confia en un tipo_cambio o monto_recibido que mande el frontend", async () => {
  // Si alguien manda un tipo_cambio/monto_recibido manipulado, se ignora: se
  // recalcula todo con el tipo de cambio vigente de verdad.
  const r = await registrarPagoSimple({
    metodo: "Efectivo", monto: 150, moneda_recibida: "USD", monto_usd: 20,
    tipo_cambio: 999, monto_recibido: 99999,
  });
  idsCreados.push(r.pago.id_transaccion);

  assert.equal(r.pago.tipo_cambio, 12);
  assert.equal(r.pago.monto_recibido, 240);
});

test("TDSI-813: rechaza el pago si los dolares no alcanzan (no se guarda nada)", async () => {
  await assert.rejects(
    () => registrarPagoSimple({ metodo: "Efectivo", monto: 150, moneda_recibida: "USD", monto_usd: 5 }),
    (e) => e.status === 400
  );
});

test("TDSI-814: la factura digital trae moneda_recibida/monto_usd/tipo_cambio para el PDF", async () => {
  const r = await registrarPagoSimple({
    metodo: "Efectivo", monto: 100, moneda_recibida: "USD", monto_usd: 10,
  });
  idsCreados.push(r.pago.id_transaccion);

  const factura = await construirFacturaDigital(r.pago.id_transaccion);
  assert.equal(factura.pagos.length, 1);
  assert.equal(factura.pagos[0].moneda_recibida, "USD");
  assert.equal(factura.pagos[0].monto_usd, 10);
  assert.equal(factura.pagos[0].tipo_cambio, 12);
});

test("TDSI-814: una venta pagada en Bs normales no trae datos de USD (undefined, no se muestra la leyenda)", async () => {
  const r = await registrarPagoSimple({ metodo: "Efectivo", monto: 50, monto_recibido: 50 });
  idsCreados.push(r.pago.id_transaccion);

  const factura = await construirFacturaDigital(r.pago.id_transaccion);
  assert.equal(factura.pagos[0].moneda_recibida, null);
});