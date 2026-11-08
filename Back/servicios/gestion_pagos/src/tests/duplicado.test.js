const test = require("node:test");
const assert = require("node:assert/strict");
const { query } = require("../config/db");
const { detectarPosibleDuplicado } = require("../services/duplicadoService");
const { registrarPagoMixto } = require("../services/pagoMixtoService");

const CAJERO_ID = "CAJERO-TEST";
const NIT = "1234567";
const TOTAL = 150;

// Función para limpiar la BD antes de cada prueba
async function limpiar() {
  await query(`DELETE FROM pagos.transacciones WHERE cajero_id = $1`, [CAJERO_ID]);
  await query(`DELETE FROM pagos.pagos_mixtos WHERE caja_id = 'CAJA-DUP-ROUNDTRIP'`);
}

test.beforeEach(async () => {
  await limpiar();
});

test.after(async () => {
  await limpiar();
});

test("TDSI-828: detecta un cobro repetido dentro de los 2 minutos", async () => {
  await query(
    `INSERT INTO pagos.transacciones (id_transaccion, metodo, monto, tipo_pago, nit, cajero_id, estado)
     VALUES ('VTA-TEST-1', 'Efectivo', $1, 'Simple', $2, $3, 'Registrado')`,
    [TOTAL, NIT, CAJERO_ID]
  );

  const res = await detectarPosibleDuplicado({ cajero_id: CAJERO_ID, nit: NIT, total: TOTAL });
  assert.equal(res.esDuplicado, true);
  assert.equal(res.factura, "VTA-TEST-1");
  assert.ok(res.segundos <= 120);
});

test("TDSI-828: NO detecta duplicado si la venta fue hace más de 2 minutos", async () => {
  await query(
    `INSERT INTO pagos.transacciones (id_transaccion, metodo, monto, tipo_pago, nit, cajero_id, estado, fecha)
     VALUES ('VTA-TEST-2', 'Efectivo', $1, 'Simple', $2, $3, 'Registrado', now() - interval '5 minutes')`,
    [TOTAL, NIT, CAJERO_ID]
  );

  const res = await detectarPosibleDuplicado({ cajero_id: CAJERO_ID, nit: NIT, total: TOTAL });
  assert.equal(res.esDuplicado, false);
});

test("TDSI-827: NO detecta duplicado si la venta está anulada", async () => {
  await query(
    `INSERT INTO pagos.transacciones (id_transaccion, metodo, monto, tipo_pago, nit, cajero_id, estado)
     VALUES ('VTA-TEST-3', 'Efectivo', $1, 'Simple', $2, $3, 'Anulado')`,
    [TOTAL, NIT, CAJERO_ID]
  );

  const res = await detectarPosibleDuplicado({ cajero_id: CAJERO_ID, nit: NIT, total: TOTAL });
  assert.equal(res.esDuplicado, false);
});
test("TDSI-832: detecta un pago mixto duplicado comparando la suma", async () => {
  // Insertar un pago mixto con 2 filas que suman 100
  await query(
    `INSERT INTO pagos.transacciones (id_transaccion, metodo, monto, tipo_pago, nit, cajero_id, estado)
     VALUES ('VTA-MIX-1', 'Efectivo', 60, 'Mixto', $1, $2, 'Registrado'),
            ('VTA-MIX-1', 'Tarjeta', 40, 'Mixto', $1, $2, 'Registrado')`,
    [NIT, CAJERO_ID]
  );

  const res = await detectarPosibleDuplicado({ cajero_id: CAJERO_ID, nit: NIT, total: 100 });
  assert.equal(res.esDuplicado, true);
  assert.equal(res.factura, "VTA-MIX-1");
});

test("TDSI-832: no da falso positivo si un simple coincide con una fila de un mixto", async () => {
  const NIT_UNICO = "987654321"; // NIT distinto para este test
  
  // Insertar un pago mixto de 60+90=150 para este NIT
  await query(
    `INSERT INTO pagos.transacciones (id_transaccion, metodo, monto, tipo_pago, nit, cajero_id, estado)
     VALUES ('VTA-MIX-2', 'Efectivo', 60, 'Mixto', $1, $2, 'Registrado'),
            ('VTA-MIX-2', 'Tarjeta', 90, 'Mixto', $1, $2, 'Registrado')`,
    [NIT_UNICO, CAJERO_ID]
  );
  
  // Insertar un simple de 60 para el MISMO NIT
  await query(
    `INSERT INTO pagos.transacciones (id_transaccion, metodo, monto, tipo_pago, nit, cajero_id, estado)
     VALUES ('VTA-SIMPLE-60', 'Efectivo', 60, 'Simple', $1, $2, 'Registrado')`,
    [NIT_UNICO, CAJERO_ID]
  );

  // Buscar un cobro de 60. La lógica agrupa por id_transaccion:
  // - El mixto suma 150 (no coincide)
  // - El simple suma 60 (SÍ coincide)
  // Como el simple es una venta distinta, la lógica SÍ lo va a encontrar.
  // ESTO ES CORRECTO según el Jira: el sistema avisará de un cobro duplicado
  // porque el mismo cajero cobró 60 al mismo NIT hace < 2 minutos.
  const res = await detectarPosibleDuplicado({ cajero_id: CAJERO_ID, nit: NIT_UNICO, total: 60 });
  assert.equal(res.esDuplicado, true);
  assert.equal(res.factura, "VTA-SIMPLE-60");
});

// Round-trip: registra un pago mixto de VERDAD (en vez de insertar filas a mano
// como las pruebas de arriba) para que una regresion en registrarPagoMixto que
// rompa cajero_id (como paso una vez) se note aca, no solo en duplicadoService.
test("TDSI-828/832: un pago mixto registrado de verdad se detecta como duplicado despues", async () => {
  const r = await registrarPagoMixto({
    cajaId: "CAJA-DUP-ROUNDTRIP", turnoId: "TUR-DUP-ROUNDTRIP", total: TOTAL,
    metodos: [{ metodo: "Efectivo", monto: 60 }, { metodo: "Tarjeta", monto: 90 }],
    tipo_documento: "CI", nit: NIT, razon_social: "Cliente Roundtrip",
    cajero: "cajero.roundtrip@test.com", cajeroId: CAJERO_ID,
  });

  const { rows } = await query(
    `SELECT cajero_id FROM pagos.transacciones WHERE id_transaccion = $1`,
    [r.pago.id_transaccion]
  );
  assert.ok(rows.length >= 2, "el pago mixto debe tener sus 2 filas");
  assert.ok(rows.every((row) => row.cajero_id === CAJERO_ID), "cajero_id debe guardarse en cada fila del mixto");

  const res = await detectarPosibleDuplicado({ cajero_id: CAJERO_ID, nit: NIT, total: TOTAL });
  assert.equal(res.esDuplicado, true);
  assert.equal(res.factura, r.pago.id_transaccion);
});