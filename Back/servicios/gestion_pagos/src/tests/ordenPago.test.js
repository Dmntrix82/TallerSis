// src/tests/ordenPago.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { recibirOrdenPago } = require("../services/ordenPagoService");

test("TDSI-391: el servicio recibe correctamente el payload base", async () => {
  const payloadDummy = { ordenCompraId: "OC-999", proveedor: "Empresa X" };
  
  const r = await recibirOrdenPago(payloadDummy);
  
  assert.equal(r.recibida, true);
  assert.equal(r.datos.ordenCompraId, "OC-999");
});