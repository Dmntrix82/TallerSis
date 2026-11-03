// TDSI-51/179: suscripcion al topico "marketplace-ventas", con Pub/Sub simulado.
// Usa la base real; lo que se guarda se borra al final.
process.env.MARKETPLACE_VENTAS_SUBSCRIPTION = "projects/proyecto-prueba/subscriptions/sub-marketplace";

const test = require("node:test");
const assert = require("node:assert/strict");
const { query, pool } = require("../config/db");
const subscriber = require("../clients/pubsubSubscriber");
const { procesarVentas } = require("../jobs/marketplaceVentas");
const { recibirVenta } = require("../services/ventaOnlineService");

const PREFIJO = `MKT-${Date.now()}`;

const ventaMsg = (ordenId, extra = {}) =>
  JSON.stringify({
    ordenId,
    cliente: "Cliente Marketplace",
    nit: "1234567",
    tipoDocumento: "CI",
    items: [{ sku: "ABC-1", descripcion: "Producto", cantidad: 2, precioUnitario: 25 }],
    total: 50,
    metodoPago: "QR",
    ...extra,
  });

// Suscripcion simulada: entrega los mensajes dados y registra que se confirmo.
function suscripcionFalsa(textos) {
  const falsa = { confirmados: [] };
  falsa.pull = async () => [{
    receivedMessages: textos.map((t, i) => ({
      ackId: `ack-${i}`,
      message: { messageId: `${PREFIJO}-m${i}`, data: Buffer.from(t), attributes: {}, publishTime: { seconds: 1760900000, nanos: 0 } },
    })),
  }];
  falsa.acknowledge = async ({ ackIds }) => falsa.confirmados.push(...ackIds);
  falsa.close = async () => {};
  return falsa;
}

test.after(async () => {
  subscriber.usarClienteDePrueba(null);
  await query(`DELETE FROM pagos.ventas_online WHERE orden_id LIKE $1`, [`${PREFIJO}%`]);
  await query(`DELETE FROM pagos.marketplace_mensajes_error WHERE message_id LIKE $1`, [`${PREFIJO}%`]);
  await pool.end();
});

test("TDSI-179: valida items + total (misma logica que el pago en mostrador) y el formato de NIT/CI", async () => {
  await assert.rejects(() => recibirVenta(null), /objeto JSON/);
  await assert.rejects(() => recibirVenta({}), /ordenId/);
  await assert.rejects(() => recibirVenta({ ordenId: "X", nit: "123", items: [] }), /dígitos/); // NIT (tipo por defecto) con formato invalido
  await assert.rejects(() => recibirVenta({ ordenId: "X", nit: "1234567890", items: [] }), /al menos un ítem/);
  await assert.rejects(
    () => recibirVenta({ ordenId: "X", nit: "1234567890", items: [{ sku: "A", cantidad: 1, precioUnitario: 10 }], total: 99 }),
    /no coincide/
  );
});

test("TDSI-179: una venta valida del topico se guarda con sus items", async () => {
  const orden = `${PREFIJO}-1`;
  subscriber.usarClienteDePrueba(suscripcionFalsa([ventaMsg(orden)]));

  const resultados = await procesarVentas();
  assert.equal(resultados.length, 1);
  assert.equal(resultados[0].ordenId, orden);
  assert.equal(resultados[0].duplicada, false);

  const { rows } = await query(
    `SELECT v.orden_id, v.total, v.metodo_pago, v.nit, v.tipo_documento, v.estado,
            (SELECT COUNT(*) FROM pagos.venta_online_items WHERE venta_id = v.id)::int AS cantidad_items
       FROM pagos.ventas_online v WHERE v.orden_id = $1`,
    [orden]
  );
  assert.deepEqual(rows[0], {
    orden_id: orden, total: "50.00", metodo_pago: "QR", nit: "1234567", tipo_documento: "CI", estado: "Pagado", cantidad_items: 1,
  });
});

test("TDSI-179: la misma orden que llega dos veces no se duplica", async () => {
  const orden = `${PREFIJO}-2`;
  subscriber.usarClienteDePrueba(suscripcionFalsa([ventaMsg(orden), ventaMsg(orden)]));

  const resultados = await procesarVentas();
  assert.deepEqual(resultados.map((r) => r.duplicada), [false, true]);

  const { rows } = await query(`SELECT COUNT(*)::int AS n FROM pagos.ventas_online WHERE orden_id = $1`, [orden]);
  assert.equal(rows[0].n, 1);
});

test("TDSI-179: un mensaje mal formado no se registra como venta, se guarda el error, y se confirma igual", async () => {
  const malo = JSON.stringify({ ordenId: `${PREFIJO}-malo`, items: [] }); // sin nit, sin items validos
  const noEsJson = "esto no es json";
  const falsa = suscripcionFalsa([malo, noEsJson]);
  subscriber.usarClienteDePrueba(falsa);

  const resultados = await procesarVentas();
  assert.equal(resultados.length, 0); // ninguno se guardo como venta

  assert.deepEqual(falsa.confirmados, ["ack-0", "ack-1"]); // pero ambos se confirman (topico propio, no se reintentan)

  const { rows } = await query(
    `SELECT message_id FROM pagos.marketplace_mensajes_error WHERE message_id LIKE $1 ORDER BY message_id`,
    [`${PREFIJO}%`]
  );
  assert.deepEqual(rows.map((r) => r.message_id), [`${PREFIJO}-m0`, `${PREFIJO}-m1`]);
});
