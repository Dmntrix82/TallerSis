const test = require("node:test");
const assert = require("node:assert/strict");
const { anularPagoOnline } = require("../services/anulacionService");
const { recibirVenta } = require("../services/ventaOnlineService");
const repo = require("../data/ventasOnlineRepo"); 

const basePayload = () => ({
  ordenId: `ORD-ANUL-${Date.now()}-${Math.random()}`,
  clienteId: "CLI-01",
  total: 50,
  metodoPago: "QR",
  items: [{ sku: "P-1", cantidad: 1, precioUnitario: 50 }]
});

test("TDSI-367: rechaza si la orden que se intenta anular no existe", async () => {
  await assert.rejects(
    () => anularPagoOnline({ ordenId: "FANTASMA-123", motivo: "Me arrepentí" }),
    (e) => e.status === 404
  );
});

test("TDSI-368: no permite anular una compra que ya fue despachada", async () => {
  const payload = basePayload();
  await recibirVenta(payload);
  await repo.marcarDespachada(payload.ordenId);

  await assert.rejects(
    () => anularPagoOnline({ ordenId: payload.ordenId, motivo: "Cancelación tardía" }),
    (e) => e.status === 409 && e.message.includes("despachada")
  );
});

test("TDSI-369: anula la orden y rechaza un segundo intento de anulación", async () => {
  const payload = basePayload();
  await recibirVenta(payload);

  // 1. Primera anulación exitosa
  const r = await anularPagoOnline({
    ordenId: payload.ordenId,
    motivo: "El cliente canceló el pedido por error"
  });

  assert.equal(r.anulacionRecibida, true);
  assert.equal(r.estado, "ANULADO");
  assert.equal(r.detalle.motivo, "El cliente canceló el pedido por error");

  // 2. Segunda anulación debe fallar (TDSI-369)
  await assert.rejects(
    () => anularPagoOnline({ ordenId: payload.ordenId, motivo: "Intento duplicado" }),
    (e) => e.status === 409 && e.message.includes("ya fue anulado")
  );
});