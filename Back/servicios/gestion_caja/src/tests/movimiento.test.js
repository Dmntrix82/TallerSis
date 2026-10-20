const test = require("node:test");
const assert = require("node:assert/strict");
const { query } = require("../config/db");
const { registrarMovimiento } = require("../services/movimientoService");
const { cerrarTurno } = require("../services/cierreService");

const CAJA_ID = "CAJA-TEST-322";
const SUPERVISOR = { supervisor_id: "SUP-TEST", pin: "1234" };
let turnoId;

test.before(async () => {
  await query(
    `INSERT INTO caja.cajas (codigo, nombre, estado)
     VALUES ($1, 'Caja Test 322', 'ACTIVA')
     ON CONFLICT (codigo) DO NOTHING`,
    [CAJA_ID]
  );

  const { rows } = await query(
    `INSERT INTO caja.turnos (codigo, caja_id, cajero_id, cajero_nombre, efectivo_inicial)
     VALUES ('TURNO-TEST-322', $1, 'U-2', 'Luis Mamani', 100)
     RETURNING id`,
    [CAJA_ID]
  );
  turnoId = rows[0].id;

  // Transacción de venta en efectivo (para que cierreService la vea al generar reporte)
  await query(
    `INSERT INTO pagos.transacciones
       (id_transaccion, metodo, monto, tipo_pago, caja_id, turno_id, estado)
     VALUES ('VTA-TEST-322-1', 'Efectivo', 80, 'Simple', $1, $2, 'Registrado')`,
    [CAJA_ID, turnoId]
  );
});

test.after(async () => {
  await query(`DELETE FROM pagos.transacciones WHERE caja_id = $1`, [CAJA_ID]);
  await query(`DELETE FROM caja.turnos WHERE id = $1`, [turnoId]);
  await query(`DELETE FROM caja.cajas WHERE codigo = $1`, [CAJA_ID]);
});

test("TDSI-322: permite registrar un movimiento mientras el turno esta abierto", async () => {
  const m = await registrarMovimiento(turnoId, { tipo: "INGRESO", metodo: "Efectivo", monto: 80, descripcion: "Venta prueba" });
  assert.equal(Number(m.monto), 80);
  assert.equal(m.tipo, "INGRESO");
});

test("TDSI-322: rechaza un monto invalido", async () => {
  await assert.rejects(
    () => registrarMovimiento(turnoId, { tipo: "INGRESO", metodo: "Efectivo", monto: -5 }),
    (e) => e.status === 400
  );
});

test("TDSI-322: cierra el turno con supervisor", async () => {
  const r = await cerrarTurno(turnoId, SUPERVISOR);
  assert.equal(r.turno.estado, "CERRADO");
  assert.equal(r.turno.cerrado_por, "SUP-TEST");
  assert.ok(r.reporte);
  assert.equal(r.reporte.totalRecaudado, 80);
});

test("TDSI-322: bloquea nuevos movimientos despues del cierre", async () => {
  await assert.rejects(
    () => registrarMovimiento(turnoId, { tipo: "INGRESO", metodo: "QR", monto: 20 }),
    (e) => e.status === 423
  );
});

test("TDSI-322: no permite cerrar un turno ya cerrado", async () => {
  await assert.rejects(() => cerrarTurno(turnoId, SUPERVISOR), (e) => e.status === 409);
});

test("TDSI-322: exige supervisor_id y pin para cerrar", async () => {
  const { rows } = await query(
    `INSERT INTO caja.turnos (codigo, caja_id, cajero_id, cajero_nombre, efectivo_inicial)
     VALUES ('TURNO-TEST-322-B', $1, 'U-2', 'Luis Mamani', 0)
     RETURNING id`,
    [CAJA_ID]
  );
  const otroTurno = rows[0].id;
  await assert.rejects(() => cerrarTurno(otroTurno, {}), (e) => e.status === 400);
  await query(`DELETE FROM caja.turnos WHERE id = $1`, [otroTurno]);
});