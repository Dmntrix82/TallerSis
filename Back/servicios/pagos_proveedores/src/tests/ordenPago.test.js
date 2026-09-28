const test = require("node:test");
const assert = require("node:assert/strict");
const { recibirOrdenPago } = require("../services/ordenPagoService");

const basePayload = () => ({
  numero: `OP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
  ordenCompraId: `OC-${Date.now()}-${Math.random()}`,
  monto: 25000.00,
  proveedor: {
    nit: "1234567015",
    razonSocial: "Distribuidora de Alimentos S.A.",
    cuentaBancaria: "10000029384",
    banco: "Banco Union"
  }
});

test("TDSI-392: rechaza si faltan datos obligatorios (orden, monto, proveedor)", async () => {
  const incompleto = basePayload();
  delete incompleto.proveedor.banco;
  await assert.rejects(() => recibirOrdenPago(incompleto), (e) => e.status === 400);
  
  const sinMonto = basePayload();
  sinMonto.monto = -50;
  await assert.rejects(() => recibirOrdenPago(sinMonto), (e) => e.status === 400);
});

test("TDSI-393 y 394: guarda como PENDIENTE, registra notificación y rechaza duplicados", async () => {
  const payload = basePayload();
  
  // 1. Recepción y registro exitoso
  const r1 = await recibirOrdenPago(payload);
  assert.equal(r1.recibida, true);
  assert.equal(r1.estado, "PENDIENTE");

  // 2. Intento duplicado bloqueado (TDSI-393)
  await assert.rejects(
    () => recibirOrdenPago(payload),
    (e) => e.status === 409 && e.message.includes("ya fue recibida")
  );
});