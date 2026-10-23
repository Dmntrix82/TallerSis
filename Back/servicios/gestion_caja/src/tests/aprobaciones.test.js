// TDSI-35: operaciones que requieren aprobacion superior (servicio y endpoints HTTP).
// Usa la BD real y facturacion (FACTURACION_URL) para validar el PIN; limpia lo que crea.
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { query } = require("../config/db");
const { errorHandler } = require("../middlewares/errorHandler");
const service = require("../services/aprobacionService");

const CAJA = "CAJA-TEST-APR-1";
const CAJERO = "CAJ-APR-1";
const SUPERVISOR = { supervisor_id: "SUP-TEST", pin: "1234" };
let turnoAbierto;
let turnoCerrado;
let servidor;
let base;

async function limpiar() {
  await query(`DELETE FROM caja.aprobaciones_especiales WHERE caja_id = $1 OR turno_id IN (SELECT id FROM caja.turnos WHERE caja_id = $1)`, [CAJA]);
  await query(`DELETE FROM caja.turnos WHERE caja_id = $1`, [CAJA]);
  await query(`DELETE FROM caja.cajas WHERE codigo = $1`, [CAJA]);
}

test.before(async () => {
  await limpiar();
  await query(`INSERT INTO caja.cajas (codigo, nombre, estado) VALUES ($1, 'Caja Test Aprobaciones', 'ACTIVA')`, [CAJA]);
  const abierto = await query(
    `INSERT INTO caja.turnos (codigo, caja_id, cajero_id, cajero_nombre, efectivo_inicial)
     VALUES ('TUR-APR-1', $1, $2, 'Cajero Aprobaciones', 100) RETURNING id`,
    [CAJA, CAJERO]
  );
  turnoAbierto = Number(abierto.rows[0].id);
  const cerrado = await query(
    `INSERT INTO caja.turnos (codigo, caja_id, cajero_id, efectivo_inicial, estado, cerrado_en)
     VALUES ('TUR-APR-2', $1, $2, 50, 'CERRADO', now()) RETURNING id`,
    [CAJA, CAJERO]
  );
  turnoCerrado = Number(cerrado.rows[0].id);

  const app = express();
  app.use(express.json());
  app.use("/api/caja/aprobaciones", require("../routes/aprobacionesRoutes"));
  app.use(errorHandler);
  await new Promise((ok) => { servidor = app.listen(0, ok); });
  base = `http://localhost:${servidor.address().port}/api/caja/aprobaciones`;
});

test.after(async () => {
  servidor.close();
  await limpiar();
});

const nueva = (extra = {}) => ({
  turno_id: turnoAbierto,
  tipo: "RETIRO_EFECTIVO",
  descripcion: "Retiro parcial por exceso de efectivo en caja",
  monto: 300,
  solicitado_por: CAJERO,
  solicitado_por_nombre: "Cajero Aprobaciones",
  ...extra,
});

// ============================================================
// TDSI-475: registrar la operacion especial
// ============================================================

test("TDSI-475: registra la operacion PENDIENTE con tipo, descripcion, turno y caja del turno", async () => {
  const s = await service.solicitar(nueva({ tipo: "retiro_efectivo", descripcion: "  Retiro parcial  ", monto: "300.456" }));
  assert.equal(s.estado, "PENDIENTE");
  assert.equal(s.tipo, "RETIRO_EFECTIVO");
  assert.equal(s.descripcion, "Retiro parcial");
  assert.equal(s.turno_id, turnoAbierto);
  assert.equal(s.caja_id, CAJA);
  assert.equal(s.monto, 300.46);
  assert.equal(s.solicitado_por, CAJERO);
  assert.equal(s.autorizado_por, null);
  assert.equal(s.resuelto_en, null);

  const sinMonto = await service.solicitar(nueva({ tipo: "REIMPRESION_FACTURA", monto: undefined }));
  assert.equal(sinMonto.monto, null);
});

test("TDSI-475: valida los datos y el turno", async () => {
  const casos = [
    [nueva({ turno_id: undefined }), 400],
    [nueva({ turno_id: "abc" }), 400],
    [nueva({ tipo: "NO_EXISTE" }), 400],
    [nueva({ tipo: undefined }), 400],
    [nueva({ descripcion: "   " }), 400],
    [nueva({ descripcion: "x".repeat(301) }), 400],
    [nueva({ solicitado_por: "" }), 400],
    [nueva({ monto: -5 }), 400],
    [nueva({ monto: "mucho" }), 400],
    [nueva({ turno_id: 999999999 }), 404],
    [nueva({ turno_id: turnoCerrado }), 409],
  ];
  for (const [datos, status] of casos) {
    await assert.rejects(() => service.solicitar(datos), (e) => e.status === status, JSON.stringify(datos));
  }
});

// ============================================================
// TDSI-476: aprobar o rechazar con supervisor, hora y motivo
// ============================================================

test("TDSI-476: aprobar guarda supervisor, nombre, hora y motivo opcional", async () => {
  const s = await service.solicitar(nueva({ tipo: "DESCUENTO_ESPECIAL", monto: 25 }));
  const r = await service.aprobar(s.id, { ...SUPERVISOR, motivo: "Cliente frecuente" });
  assert.equal(r.estado, "APROBADA");
  assert.equal(r.autorizado_por, "SUP-TEST");
  assert.equal(r.autorizado_por_nombre, "Supervisor Prueba");
  assert.equal(r.motivo, "Cliente frecuente");
  assert.ok(r.resuelto_en instanceof Date);

  const sinMotivo = await service.solicitar(nueva({ tipo: "VENTA_MONTO_ALTO" }));
  assert.equal((await service.aprobar(sinMotivo.id, SUPERVISOR)).motivo, null);
});

test("TDSI-476: rechazar exige motivo y no se puede resolver dos veces", async () => {
  const s = await service.solicitar(nueva({ tipo: "CAMBIO_METODO_PAGO", monto: 80 }));

  await assert.rejects(() => service.rechazar(s.id, SUPERVISOR), (e) => e.status === 400);
  await assert.rejects(() => service.rechazar(s.id, { ...SUPERVISOR, motivo: "   " }), (e) => e.status === 400);
  await assert.rejects(() => service.rechazar(s.id, { motivo: "x" }), (e) => e.status === 400); // sin PIN
  await assert.rejects(() => service.aprobar(s.id, { supervisor_id: "SUP-TEST", pin: "0000" }), (e) => e.status === 401);

  const r = await service.rechazar(s.id, { ...SUPERVISOR, motivo: "  No corresponde el cambio  " });
  assert.equal(r.estado, "RECHAZADA");
  assert.equal(r.motivo, "No corresponde el cambio");

  await assert.rejects(() => service.aprobar(s.id, SUPERVISOR), (e) => e.status === 409);
  await assert.rejects(() => service.rechazar(s.id, { ...SUPERVISOR, motivo: "otra vez" }), (e) => e.status === 409);
  await assert.rejects(() => service.aprobar("abc", SUPERVISOR), (e) => e.status === 400);
  await assert.rejects(() => service.aprobar(999999999, SUPERVISOR), (e) => e.status === 404);
});

// ============================================================
// TDSI-477: listar con filtros por estado y tipo
// ============================================================

test("TDSI-477: lista primero las pendientes y filtra por estado, tipo y caja", async () => {
  const todas = await service.listar({ caja_id: CAJA });
  assert.equal(todas.total, 5);
  assert.equal(todas.pendientes, 2);
  assert.deepEqual(todas.data.slice(0, 2).map((a) => a.estado), ["PENDIENTE", "PENDIENTE"]);

  const aprobadas = await service.listar({ caja_id: CAJA, estado: "aprobada" });
  assert.equal(aprobadas.filtros.estado, "APROBADA");
  assert.deepEqual(aprobadas.data.map((a) => a.tipo).sort(), ["DESCUENTO_ESPECIAL", "VENTA_MONTO_ALTO"]);

  const retiros = await service.listar({ caja_id: CAJA, tipo: "RETIRO_EFECTIVO" });
  assert.deepEqual(retiros.data.map((a) => [a.tipo, a.estado]), [["RETIRO_EFECTIVO", "PENDIENTE"]]);

  assert.equal((await service.listar({ caja_id: "CAJA-NO-EXISTE" })).total, 0);
  await assert.rejects(() => service.listar({ estado: "CERRADA" }), (e) => e.status === 400);
  await assert.rejects(() => service.listar({ tipo: "OTRA_COSA" }), (e) => e.status === 400);
});

// ============================================================
// TDSI-478: endpoints HTTP
// ============================================================

const pedir = async (ruta, opciones = {}) => {
  const r = await fetch(`${base}${ruta}`, {
    method: opciones.method || "GET",
    headers: { "Content-Type": "application/json" },
    body: opciones.body ? JSON.stringify(opciones.body) : undefined,
  });
  return { status: r.status, cuerpo: await r.json() };
};

test("TDSI-478: GET /tipos devuelve el catalogo", async () => {
  const { status, cuerpo } = await pedir("/tipos");
  assert.equal(status, 200);
  assert.ok(cuerpo.data.some((t) => t.codigo === "RETIRO_EFECTIVO" && t.descripcion));
});

test("TDSI-478: flujo completo por HTTP (registrar, bandeja, aprobar, rechazar, detalle)", async () => {
  const creada = await pedir("/", { method: "POST", body: nueva({ tipo: "OTRO", descripcion: "Apertura de gaveta sin venta", monto: undefined }) });
  assert.equal(creada.status, 201);
  assert.equal(creada.cuerpo.data.estado, "PENDIENTE");
  const id = creada.cuerpo.data.id;

  const bandeja = await pedir(`/?estado=PENDIENTE&caja_id=${CAJA}`);
  assert.equal(bandeja.status, 200);
  assert.ok(bandeja.cuerpo.data.some((a) => a.id === id));
  assert.equal(bandeja.cuerpo.total, bandeja.cuerpo.pendientes);

  const sinMotivo = await pedir(`/${id}/rechazar`, { method: "POST", body: SUPERVISOR });
  assert.equal(sinMotivo.status, 400);
  assert.equal(sinMotivo.cuerpo.ok, false);
  assert.ok(sinMotivo.cuerpo.mensaje);

  const aprobada = await pedir(`/${id}/aprobar`, { method: "POST", body: { ...SUPERVISOR, motivo: "Verificado en camara" } });
  assert.equal(aprobada.status, 200);
  assert.equal(aprobada.cuerpo.data.estado, "APROBADA");

  const otraVez = await pedir(`/${id}/rechazar`, { method: "POST", body: { ...SUPERVISOR, motivo: "x" } });
  assert.equal(otraVez.status, 409);

  const detalle = await pedir(`/${id}`);
  assert.equal(detalle.cuerpo.data.autorizado_por_nombre, "Supervisor Prueba");

  assert.equal((await pedir("/999999999")).status, 404);
  assert.equal((await pedir("/?tipo=NO_EXISTE")).status, 400);
  assert.equal((await pedir("/", { method: "POST", body: { tipo: "OTRO" } })).status, 400);
});
