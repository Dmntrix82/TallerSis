const test = require("node:test");
const assert = require("node:assert/strict");
const { recibirOrdenPago } = require("../services/ordenPagoService");

// Generador de un payload válido simulando lo que enviará el módulo de Compras
const basePayload = () => ({
  ordenCompraId: `OC-${Date.now()}`,
  montoTotal: 15000.50,
  proveedor: {
    id: "PROV-001",
    nombre: "Distribuidora de Alimentos S.A.",
    cuentaBancaria: "10000029384"
  }
});

test("TDSI-391/392: el servicio recibe y valida correctamente el payload completo", async () => {
  const payload = basePayload();
  const r = await recibirOrdenPago(payload);
  
  assert.equal(r.recibida, true);
  assert.equal(r.ordenCompraId, payload.ordenCompraId);
});

// NUEVOS TESTS: TDSI-392
test("TDSI-392: rechaza si falta el ordenCompraId o el monto es inválido", async () => {
  const sinOrden = basePayload();
  delete sinOrden.ordenCompraId;
  await assert.rejects(() => recibirOrdenPago(sinOrden), (e) => e.status === 400);

  const montoInvalido = basePayload();
  montoInvalido.montoTotal = -500; // No se puede pagar negativo
  await assert.rejects(() => recibirOrdenPago(montoInvalido), (e) => e.status === 400);
});

test("TDSI-392: rechaza si los datos del proveedor están incompletos", async () => {
  const sinProveedor = basePayload();
  delete sinProveedor.proveedor;
  await assert.rejects(() => recibirOrdenPago(sinProveedor), (e) => e.status === 400);

  const proveedorIncompleto = basePayload();
  delete proveedorIncompleto.proveedor.cuentaBancaria;
  await assert.rejects(
    () => recibirOrdenPago(proveedorIncompleto), 
    (e) => e.message.includes("cuentaBancaria")
  );
});