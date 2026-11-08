// TDSI-51/179/683/684: suscripcion al topico "marketplace-ventas", con Pub/Sub simulado.
// Usa la base real + facturacion (FACTURACION_URL) para emitir la factura de verdad;
// lo que se guarda se borra al final.
process.env.MARKETPLACE_VENTAS_SUBSCRIPTION = "projects/proyecto-prueba/subscriptions/sub-marketplace";
process.env.MARKETPLACE_FACTURAS_TOPIC = "projects/proyecto-prueba/topics/pagos-facturas-emitidas";

const test = require("node:test");
const assert = require("node:assert/strict");
const { query, pool } = require("../config/db");
const subscriber = require("../clients/pubsubSubscriber");
const publisher = require("../clients/pubsubPublisher");
const { procesarVentas } = require("../jobs/marketplaceVentas");
const { recibirVenta } = require("../services/ventaOnlineService");
const { obtenerFacturaPorToken } = require("../services/verificacionFacturaService");

const PREFIJO = `MKT-${Date.now()}`;
// CI de 7 digitos, unico por corrida -- evita chocar con el NIT de otras pruebas.
const NIT_PRUEBA = String(Date.now()).slice(-7);

const ventaMsg = (ordenId, extra = {}) =>
  JSON.stringify({
    ordenId,
    cliente: "Cliente Marketplace",
    nit: NIT_PRUEBA,
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

// Topico de salida simulado: por defecto publica bien (como si Pub/Sub respondiera ok).
const topicoQuePublicaBien = () => ({ topic: () => ({ publishMessage: async () => "pub-1" }) });
const topicoQueFalla = (motivo) => ({ topic: () => ({ publishMessage: async () => { throw new Error(motivo); } }) });

test.before(() => {
  publisher.usarClienteDePrueba(topicoQuePublicaBien());
});

test.after(async () => {
  subscriber.usarClienteDePrueba(null);
  publisher.usarClienteDePrueba(null);
  await query(`DELETE FROM pagos.ventas_online WHERE orden_id LIKE $1`, [`${PREFIJO}%`]);
  await query(`DELETE FROM pagos.marketplace_mensajes_error WHERE message_id LIKE $1`, [`${PREFIJO}%`]);
  // TDSI-683: las facturas se emiten de verdad en facturacion (ON DELETE CASCADE se
  // encarga de sus items y su envio a Contabilidad). Por NIT, no por numero: cualquier
  // venta valida del topico (incluida la primera de una orden repetida) emite la suya.
  await query(`DELETE FROM facturacion.facturas WHERE cliente_nit = $1`, [NIT_PRUEBA]);
  await query(`DELETE FROM facturacion.clientes_frecuentes WHERE nit = $1`, [NIT_PRUEBA]);
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

test("TDSI-179/683/684: una venta valida del topico se guarda, emite su factura y avisa al Marketplace", async () => {
  const orden = `${PREFIJO}-1`;
  subscriber.usarClienteDePrueba(suscripcionFalsa([ventaMsg(orden)]));

  const resultados = await procesarVentas();
  assert.equal(resultados.length, 1);
  assert.equal(resultados[0].ordenId, orden);
  assert.equal(resultados[0].duplicada, false);
  assert.match(resultados[0].numeroFactura, /^F-\d{6}$/);
  assert.equal(resultados[0].facturaError, null);
  assert.deepEqual(resultados[0].aviso.publicado, true);
  assert.ok(resultados[0].aviso.messageId);

  const { rows } = await query(
    `SELECT v.orden_id, v.total, v.metodo_pago, v.nit, v.tipo_documento, v.estado, v.numero_factura, v.factura_error,
            v.aviso_marketplace_estado, v.aviso_marketplace_error, v.token_verificacion,
            (SELECT COUNT(*) FROM pagos.venta_online_items WHERE venta_id = v.id)::int AS cantidad_items
       FROM pagos.ventas_online v WHERE v.orden_id = $1`,
    [orden]
  );
  assert.deepEqual(
    { ...rows[0], token_verificacion: rows[0].token_verificacion ? "presente" : null },
    {
      orden_id: orden, total: "50.00", metodo_pago: "QR", nit: NIT_PRUEBA, tipo_documento: "CI", estado: "Pagado",
      numero_factura: resultados[0].numeroFactura, factura_error: null, cantidad_items: 1,
      aviso_marketplace_estado: "Enviado", aviso_marketplace_error: null, token_verificacion: "presente",
    }
  );

  // La factura que de verdad quedo en facturacion coincide con lo que se guardo aca.
  const { rows: factura } = await query(
    `SELECT cliente_nit, total FROM facturacion.facturas WHERE numero = $1`,
    [resultados[0].numeroFactura]
  );
  assert.equal(factura[0].cliente_nit, NIT_PRUEBA);
  assert.equal(Number(factura[0].total), 50);

  // TDSI-51/684: el enlace "Verificar Factura" publicado tiene que funcionar de verdad.
  const verificada = await obtenerFacturaPorToken(rows[0].token_verificacion);
  assert.equal(verificada.id_transaccion, resultados[0].numeroFactura);
  assert.equal(verificada.total, 50);
  assert.equal(verificada.nit, NIT_PRUEBA);
});

test("TDSI-684: si Pub/Sub no responde al publicar el aviso, queda Error pero la venta y su factura no se pierden", async () => {
  const orden = `${PREFIJO}-4`;
  publisher.usarClienteDePrueba(topicoQueFalla("el topico no existe"));
  try {
    subscriber.usarClienteDePrueba(suscripcionFalsa([ventaMsg(orden)]));
    const resultados = await procesarVentas();
    assert.equal(resultados[0].aviso.publicado, false);
    assert.match(resultados[0].aviso.error, /el topico no existe/);
    assert.match(resultados[0].numeroFactura, /^F-\d{6}$/); // la factura SI se emitio

    const { rows } = await query(
      `SELECT numero_factura, aviso_marketplace_estado, aviso_marketplace_error FROM pagos.ventas_online WHERE orden_id = $1`,
      [orden]
    );
    assert.match(rows[0].numero_factura, /^F-\d{6}$/);
    assert.equal(rows[0].aviso_marketplace_estado, "Error");
    assert.match(rows[0].aviso_marketplace_error, /el topico no existe/);
  } finally {
    publisher.usarClienteDePrueba(topicoQuePublicaBien());
  }
});

test("TDSI-684: si la factura no se pudo emitir, no se intenta avisar al Marketplace", async () => {
  const orden = `${PREFIJO}-5`;
  subscriber.usarClienteDePrueba(suscripcionFalsa([ventaMsg(orden, { cliente: undefined })]));

  const resultados = await procesarVentas();
  assert.equal(resultados[0].numeroFactura, null);
  assert.equal(resultados[0].aviso, null);

  const { rows } = await query(
    `SELECT aviso_marketplace_estado, token_verificacion FROM pagos.ventas_online WHERE orden_id = $1`,
    [orden]
  );
  assert.equal(rows[0].aviso_marketplace_estado, null);
  assert.equal(rows[0].token_verificacion, null);
});

test("TDSI-683: si facturacion no puede emitir la factura, la venta queda guardada igual, con el error y sin numero", async () => {
  const orden = `${PREFIJO}-3`;
  // Sin 'cliente' ni 'razonSocial': nuestra validacion no los exige, pero facturacion
  // si exige razon_social para crear la factura -- falla ahi, no al guardar la venta.
  subscriber.usarClienteDePrueba(suscripcionFalsa([ventaMsg(orden, { cliente: undefined })]));

  const resultados = await procesarVentas();
  assert.equal(resultados.length, 1);
  assert.equal(resultados[0].duplicada, false);
  assert.equal(resultados[0].numeroFactura, null);
  assert.match(resultados[0].facturaError, /razón social|razon_social/i);

  const { rows } = await query(
    `SELECT numero_factura, factura_error FROM pagos.ventas_online WHERE orden_id = $1`,
    [orden]
  );
  assert.equal(rows[0].numero_factura, null);
  assert.ok(rows[0].factura_error);
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
