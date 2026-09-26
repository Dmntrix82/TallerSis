const test = require("node:test");
const assert = require("node:assert/strict");
const { anularPagoOnline } = require("../services/anulacionService");
const { recibirVenta } = require("../services/ventaOnlineService");

test("TDSI-367: rechaza si la orden que se intenta anular no existe", async () => {
  await assert.rejects(
    () => anularPagoOnline({ ordenId: "FANTASMA-123", motivo: "Me arrepentí" }),
    (e) => e.status === 404
  );
});

test("TDSI-367: recibe la solicitud de anulación de una orden existente", async () => {
  const ordenId = `ORD-ANUL-${Date.now()}`;
  
  // Guardamos una orden real primero
  await recibirVenta({
    ordenId,
    total: 50,
    metodoPago: "QR",
    items: [{ sku: "P-1", cantidad: 1, precioUnitario: 50 }]
  });

  // Solicitamos la anulación
  const r = await anularPagoOnline({
    ordenId,
    motivo: "El cliente canceló el pedido por error"
  });

  assert.equal(r.anulacionRecibida, true);
  assert.equal(r.ordenId, ordenId);
});