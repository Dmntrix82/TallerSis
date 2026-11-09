// TDSI-48/897: anular una venta ahora exige un motivo (elegido entre las respuestas
// rapidas de anulacion del cajero, o escrito a mano) y lo guarda en la venta anulada.
// Usa la BD real y un supervisor real de facturacion (FACTURACION_URL).
const test = require("node:test");
const assert = require("node:assert/strict");
const { query } = require("../config/db");
const { registrarPagoSimple } = require("../services/pagoSimpleService");
const { anularVenta } = require("../services/ventasCajeroService");

// No hay endpoint HTTP para crear supervisores en esta rama (eso lo agrega TDSI-55,
// todavia no fusionado); se inserta directo igual que lo hace facturacion internamente.
const crypto = require("crypto");
function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pin, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const SUFIJO = Date.now();
const CAJERO = `test.anular.${SUFIJO}@tallersis.bo`;
const CAJA = `TEST-ANULAR-${SUFIJO}`;
const SUPERVISOR_ID = `SUP-ANULAR-${SUFIJO}`;
const PIN = "4321";

let idVenta;

test.before(async () => {
  await query(
    `INSERT INTO facturacion.supervisores (supervisor_id, nombre, pin_hash, activo) VALUES ($1, $2, $3, true)`,
    [SUPERVISOR_ID, "Supervisor de prueba", hashPin(PIN)]
  );
});

test.beforeEach(async () => {
  const r = await registrarPagoSimple({ metodo: "QR", monto: 25, caja_id: CAJA, cajero: CAJERO });
  idVenta = r.pago.id_transaccion;
});

test.after(async () => {
  await query(`DELETE FROM pagos.transacciones WHERE cajero = $1`, [CAJERO]);
  await query(`DELETE FROM facturacion.supervisores WHERE supervisor_id = $1`, [SUPERVISOR_ID]);
});

test("TDSI-897: anula con un motivo valido y lo guarda en la venta", async () => {
  const res = await anularVenta({
    id_transaccion: idVenta, cajero: CAJERO, supervisor_id: SUPERVISOR_ID, pin: PIN,
    motivo: "El cliente desistió de la compra",
  });
  assert.equal(res.motivo, "El cliente desistió de la compra");

  const { rows } = await query(`SELECT estado, motivo_anulacion FROM pagos.transacciones WHERE id_transaccion = $1`, [idVenta]);
  assert.equal(rows[0].estado, "Anulado");
  assert.equal(rows[0].motivo_anulacion, "El cliente desistió de la compra");
});

test("TDSI-897: rechaza anular sin motivo o con menos de 10 caracteres", async () => {
  await assert.rejects(
    () => anularVenta({ id_transaccion: idVenta, cajero: CAJERO, supervisor_id: SUPERVISOR_ID, pin: PIN }),
    (e) => e.status === 400
  );
  await assert.rejects(
    () => anularVenta({ id_transaccion: idVenta, cajero: CAJERO, supervisor_id: SUPERVISOR_ID, pin: PIN, motivo: "Corto" }),
    (e) => e.status === 400
  );

  const { rows } = await query(`SELECT estado FROM pagos.transacciones WHERE id_transaccion = $1`, [idVenta]);
  assert.equal(rows[0].estado, "Registrado", "no debe quedar anulada si el motivo no es valido");
});

test("TDSI-897: rechaza un motivo de mas de 100 caracteres", async () => {
  await assert.rejects(
    () => anularVenta({
      id_transaccion: idVenta, cajero: CAJERO, supervisor_id: SUPERVISOR_ID, pin: PIN,
      motivo: "a".repeat(101),
    }),
    (e) => e.status === 400
  );
});

test("TDSI-897: el motivo elegido de una respuesta rapida se guarda igual si despues se edita o se borra", async () => {
  // Simula el flujo del frontend: el cajero elige una respuesta rapida, cuyo texto
  // ya viaja completo en "motivo" (no un id) -- asi la venta anulada no depende de
  // que esa respuesta siga existiendo despues.
  await anularVenta({
    id_transaccion: idVenta, cajero: CAJERO, supervisor_id: SUPERVISOR_ID, pin: PIN,
    motivo: "NIT del cliente mal registrado",
  });

  const { rows } = await query(`SELECT motivo_anulacion FROM pagos.transacciones WHERE id_transaccion = $1`, [idVenta]);
  assert.equal(rows[0].motivo_anulacion, "NIT del cliente mal registrado");
});
