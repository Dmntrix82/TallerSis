// TDSI-62/201/955/958: operaciones especiales de caja (retiro de efectivo, descuento
// fuera de lo permitido, etc.) autorizadas por un supervisor EN EL MOMENTO con su
// usuario + PIN -- no hay solicitud pendiente ni bandeja de espera (a diferencia del
// viejo modulo de "Aprobaciones" con cola, que ya no existe). BD real + facturacion
// (FACTURACION_URL) para validar al supervisor; limpia lo que crea.
const test = require("node:test");
const assert = require("node:assert/strict");
const { registrar, listar, obtener } = require("../services/operacionEspecialService");
const turnosRepo = require("../data/turnosRepo");
const { query } = require("../config/db");

const CAJA = "CAJA-TEST-62";
const SUPERVISOR = { supervisor_id: "SUP-TEST", pin: "1234" };
let turnoId;

test.before(async () => {
  await query(`DELETE FROM caja.aprobaciones_especiales WHERE caja_id = $1`, [CAJA]);
  await query(`DELETE FROM caja.turnos WHERE caja_id = $1`, [CAJA]);
  await query(`DELETE FROM caja.cajas WHERE codigo = $1`, [CAJA]);
  await query(`INSERT INTO caja.cajas (codigo, nombre, estado) VALUES ($1, 'Caja Test 62', 'ACTIVA')`, [CAJA]);

  const turno = await turnosRepo.crearTurno({
    caja_id: CAJA, cajero_id: "cajero-62@test.com", efectivo_inicial: 100,
    autorizado_por: SUPERVISOR.supervisor_id, autorizado_por_nombre: "Supervisor Prueba",
  });
  turnoId = turno.id;
});

test.after(async () => {
  await query(`DELETE FROM caja.aprobaciones_especiales WHERE caja_id = $1`, [CAJA]);
  await query(`DELETE FROM caja.turnos WHERE caja_id = $1`, [CAJA]);
  await query(`DELETE FROM caja.cajas WHERE codigo = $1`, [CAJA]);
});

test("TDSI-62/201/955: registra la operacion ya autorizada, con el cajero y el supervisor real", async () => {
  const r = await registrar({
    turno_id: turnoId, tipo: "RETIRO_EFECTIVO", descripcion: "Retiro para cambio", monto: 50,
    cajero_id: "cajero-62@test.com", cajero_nombre: "Juana Perez",
    ...SUPERVISOR,
  });

  assert.equal(r.solicitado_por, "cajero-62@test.com");
  assert.equal(r.solicitado_por_nombre, "Juana Perez");
  assert.equal(r.autorizado_por, "SUP-TEST");
  assert.equal(r.autorizado_por_nombre, "Supervisor Prueba");
  assert.equal(r.estado, "APROBADA");
  assert.ok(r.resuelto_en, "debe quedar resuelta de inmediato, no pendiente");
  assert.equal(r.turno_id, turnoId);
  assert.equal(r.caja_id, CAJA);
  assert.equal(r.monto, 50);
});

test("TDSI-62: no queda nada registrado si el PIN del supervisor es incorrecto", async () => {
  await assert.rejects(
    () => registrar({
      turno_id: turnoId, tipo: "RETIRO_EFECTIVO", descripcion: "Intento fallido",
      cajero_id: "cajero-62@test.com", supervisor_id: "SUP-TEST", pin: "0000",
    }),
    (e) => e.status === 401
  );

  const { data } = await listar({ caja_id: CAJA });
  assert.ok(!data.some((o) => o.descripcion === "Intento fallido"));
});

test("TDSI-62: valida tipo, descripcion, cajero_id y que venga usuario+PIN del supervisor", async () => {
  await assert.rejects(
    () => registrar({ turno_id: turnoId, tipo: "NO_EXISTE", descripcion: "X", cajero_id: "c", ...SUPERVISOR }),
    (e) => e.status === 400
  );
  await assert.rejects(
    () => registrar({ turno_id: turnoId, tipo: "OTRO", cajero_id: "c", ...SUPERVISOR }),
    (e) => e.status === 400
  );
  await assert.rejects(
    () => registrar({ turno_id: turnoId, tipo: "OTRO", descripcion: "X", ...SUPERVISOR }),
    (e) => e.status === 400
  );
  await assert.rejects(
    () => registrar({ turno_id: turnoId, tipo: "OTRO", descripcion: "X", cajero_id: "c" }),
    (e) => e.status === 400
  );
});

test("TDSI-62: 404 si el turno no existe, 409 si ya esta cerrado", async () => {
  await assert.rejects(
    () => registrar({ turno_id: 999999999, tipo: "OTRO", descripcion: "X", cajero_id: "c", ...SUPERVISOR }),
    (e) => e.status === 404
  );

  const cerrado = await turnosRepo.marcarCerrado(turnoId, {
    efectivoContado: null, efectivoEsperado: null, diferencia: null, tipoDiferencia: null,
    cerradoPor: SUPERVISOR.supervisor_id, cerradoPorNombre: "Supervisor Prueba",
  });
  assert.equal(cerrado.estado, "CERRADO");

  await assert.rejects(
    () => registrar({ turno_id: turnoId, tipo: "OTRO", descripcion: "X", cajero_id: "c", ...SUPERVISOR }),
    (e) => e.status === 409
  );
});

test("TDSI-62/957: lista el historial y filtra por supervisor", async () => {
  const { data } = await listar({ supervisor_id: "SUP-TEST" });
  assert.ok(data.length >= 1);
  assert.ok(data.every((o) => o.autorizado_por === "SUP-TEST"));

  const vacio = await listar({ supervisor_id: "NO-EXISTE" });
  assert.equal(vacio.data.length, 0);
});

test("TDSI-62: GET /:id trae la operacion, 404 si no existe", async () => {
  const { data } = await listar({ caja_id: CAJA });
  const primera = data[0];
  const encontrada = await obtener(primera.id);
  assert.equal(encontrada.id, primera.id);

  await assert.rejects(() => obtener(999999999), (e) => e.status === 404);
});

test("TDSI-62: GET /tipos devuelve el catalogo", async () => {
  const { listarTipos } = require("../services/operacionEspecialService");
  const tipos = listarTipos();
  assert.ok(tipos.some((t) => t.codigo === "RETIRO_EFECTIVO"));
});
