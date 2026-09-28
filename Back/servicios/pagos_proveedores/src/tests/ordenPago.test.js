const test = require("node:test");
const assert = require("node:assert/strict");
const { recibirOrdenPago, listarOrdenesPendientes } = require("../services/ordenPagoService");
const { pool } = require("../config/db");

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

test("TDSI-392: rechaza fechaVencimiento invalida o concepto demasiado largo", async () => {
  for (const fecha of ["2026-02-31", "31/12/2026", "manana", 20261231]) {
    const p = basePayload();
    p.fechaVencimiento = fecha;
    await assert.rejects(() => recibirOrdenPago(p), (e) => e.status === 400 && e.message.includes("fechaVencimiento"));
  }

  const largo = basePayload();
  largo.concepto = "x".repeat(201);
  await assert.rejects(() => recibirOrdenPago(largo), (e) => e.status === 400 && e.message.includes("concepto"));
});

test("TDSI-393: guarda fechaVencimiento y concepto y los muestra en la bandeja", async () => {
  const payload = { ...basePayload(), fechaVencimiento: "2026-12-31", concepto: "  Compra de insumos  " };

  try {
    await recibirOrdenPago(payload);

    const pendientes = await listarOrdenesPendientes();
    const guardada = pendientes.find((o) => o.id === payload.numero);
    assert.ok(guardada, "la orden debe aparecer en la lista de pendientes");
    assert.equal(guardada.fechaVencimiento, "2026-12-31");
    assert.equal(guardada.concepto, "Compra de insumos");
    assert.equal(guardada.estado, "PENDIENTE");
  } finally {
    // esta prueba limpia su propio dato para no ensuciar la base compartida
    await pool.query(
      "DELETE FROM proveedores.notificaciones_admin WHERE orden_pago_id IN (SELECT id FROM proveedores.ordenes_pago WHERE numero = $1)",
      [payload.numero]
    );
    await pool.query("DELETE FROM proveedores.ordenes_pago WHERE numero = $1", [payload.numero]);
  }
});
