const test = require("node:test");
const assert = require("node:assert/strict");
const { calcularDivision, registrarPagoMixto } = require("../services/pagoMixtoService");
const { historialTransacciones, pagosMixtos, detallesPago } = require("../data/memoria");

function limpiar() {
  historialTransacciones.length = 0;
  pagosMixtos.length = 0;
  detallesPago.length = 0;
}
test.beforeEach(limpiar);

test("TDSI-87: divide con dos montos exactos", () => {
  const r = calcularDivision({ total: 250, metodos: [{ metodo: "Efectivo", monto: 100 }, { metodo: "QR", monto: 150 }] });
  assert.equal(r.cuadra, true);
});

test("TDSI-87: calcula el restante cuando falta un monto", () => {
  const r = calcularDivision({ total: 250, metodos: [{ metodo: "Efectivo", monto: 90.5 }, { metodo: "Tarjeta" }] });
  assert.equal(r.metodos[1].monto, 159.5);
});

test("TDSI-275: rechaza cuando la suma no coincide", () => {
  assert.throws(() => calcularDivision({ total: 250, metodos: [{ metodo: "Efectivo", monto: 100 }, { metodo: "QR", monto: 140 }] }), /no coincide/);
});

test("TDSI-276: guarda el detalle del pago mixto (montos y métodos)", () => {
  const r = registrarPagoMixto({ id_transaccion: "TX-1", cajaId: "C-1", turnoId: "T-1", total: 250, metodos: [{ metodo: "Efectivo", monto: 100 }, { metodo: "QR", monto: 150 }] });
  assert.equal(r.detalle.length, 2);
  assert.equal(detallesPago.length, 2);
});

test("TDSI-277: registra el pago mixto en el historial de transacciones (TDSI-272)", () => {
  registrarPagoMixto({ id_transaccion: "TX-2", cajaId: "C-1", turnoId: "T-1", total: 250, metodos: [{ metodo: "Efectivo", monto: 100 }, { metodo: "QR", monto: 150 }] });
  assert.equal(historialTransacciones.length, 2);
  assert.equal(historialTransacciones.reduce((a, t) => a + t.monto, 0), 250);
});