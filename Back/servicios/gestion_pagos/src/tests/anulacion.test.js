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

  // Sobrescribimos temporalmente fetch para que falle (simula sistema caído)
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: false });

  const r = await anularPagoOnline({
    ordenId: payload.ordenId,
    motivo: "El cliente canceló el pedido por error"
  });

  assert.equal(r.anulacionRecibida, true);
  assert.equal(r.estado, "ANULADO");
  assert.equal(r.detalle.notificado, false); // Falló la notificación, pero sí anuló
  
  global.fetch = originalFetch; // Restauramos

  await assert.rejects(
    () => anularPagoOnline({ ordenId: payload.ordenId, motivo: "Intento duplicado" }),
    (e) => e.status === 409 && e.message.includes("ya fue anulado")
  );
});

// NUEVO: Test TDSI-370
test("TDSI-370: notifica al sistema cliente y actualiza estado notificado", async () => {
  const payload = basePayload();
  await recibirVenta(payload);

  // Simulamos que el sistema cliente responde 200 OK
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: true });

  const r = await anularPagoOnline({
    ordenId: payload.ordenId,
    motivo: "Cancelación exitosa con notificación"
  });

  assert.equal(r.detalle.notificado, true);
  assert.equal(r.mensaje, "Pago anulado y sistema notificado");

  global.fetch = originalFetch;
});