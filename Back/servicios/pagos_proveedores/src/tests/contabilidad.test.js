// TDSI-636/420: proxy de Contabilidad contra un receptor HTTP levantado en la prueba (no usa la BD).
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

let servidor;
let respuesta = { status: 200, cuerpo: { periodo: "2026-10", estado: "ABIERTO" } };
let ultima = null; // { metodo, url, headers, cuerpo } de la ultima solicitud recibida

test.before(async () => {
  servidor = http.createServer((req, res) => {
    let datos = "";
    req.on("data", (c) => (datos += c));
    req.on("end", () => {
      ultima = { metodo: req.method, url: req.url, headers: req.headers, cuerpo: datos ? JSON.parse(datos) : null };
      if (respuesta.colgar) return; // nunca responde -> timeout
      res.writeHead(respuesta.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(respuesta.cuerpo));
    });
  });
  await new Promise((ok) => servidor.listen(0, ok));
  process.env.MODO_AISLADO = "false";
  process.env.CONTABILIDAD_URL = `http://localhost:${servidor.address().port}`;
  process.env.CONTABILIDAD_TOKEN = "token-prueba";
  process.env.INTEGRACIONES_TIMEOUT_MS = "500";
});

test.after(() => {
  servidor.closeAllConnections();
  servidor.close();
});

const proxy = () => require("../clients/contabilidadProxy");

test("TDSI-636: consulta el periodo de la fecha y lo informa ABIERTO", async () => {
  respuesta = { status: 200, cuerpo: { periodo: "2026-10", estado: "ABIERTO" } };
  const r = await proxy().consultarPeriodoContable("2026-10-08");
  assert.equal(ultima.url, "/periodos-contables/estado?fecha=2026-10-08");
  assert.deepEqual(r, { disponible: true, periodo: "2026-10", abierto: true, estado: "ABIERTO", origen: "CONTABILIDAD" });
});

test("TDSI-636: informa un periodo CERRADO (tambien con el formato { abierto: false })", async () => {
  respuesta = { status: 200, cuerpo: { periodo: "2026-09", estado: "cerrado" } };
  assert.equal((await proxy().consultarPeriodoContable("2026-09-30")).abierto, false);
  respuesta = { status: 200, cuerpo: { ok: true, data: { abierto: false } } };
  const r = await proxy().consultarPeriodoContable("2026-09-30");
  assert.equal(r.abierto, false);
  assert.equal(r.periodo, "2026-09");
});

test("TDSI-636: Contabilidad caida, lenta o con respuesta rara -> disponible: false", async () => {
  respuesta = { status: 503, cuerpo: { error: "x" } };
  let r = await proxy().consultarPeriodoContable("2026-10-08");
  assert.equal(r.disponible, false);
  assert.match(r.motivo, /HTTP 503/);

  respuesta = { status: 200, cuerpo: { hola: "mundo" } };
  r = await proxy().consultarPeriodoContable("2026-10-08");
  assert.equal(r.disponible, false);
  assert.match(r.motivo, /no reconocida/);

  respuesta = { colgar: true };
  r = await proxy().consultarPeriodoContable("2026-10-08");
  assert.equal(r.disponible, false);
  assert.match(r.motivo, /no respondio/);
});

test("TDSI-636: receptor simulado del modo aislado", () => {
  const { periodoSimulado } = proxy();
  const opciones = { CONTABILIDAD_SIMULADO_CERRADOS: ["2026-09"], CONTABILIDAD_SIMULAR_CAIDA: false };
  assert.equal(periodoSimulado("2026-10-08", opciones).abierto, true);
  assert.equal(periodoSimulado("2026-09-15", opciones).abierto, false);
  assert.equal(periodoSimulado("2026-09-15", opciones).origen, "SIMULADO");
  const caida = periodoSimulado("2026-10-08", { ...opciones, CONTABILIDAD_SIMULAR_CAIDA: true });
  assert.equal(caida.disponible, false);
});

const reporte = { tipo: "REPORTE_CIERRE_DIARIO", lote_id: 8, fecha: "2026-10-09", neto: 315 };

test("TDSI-420: envia el reporte por POST con Idempotency-Key y token, y lee la referencia", async () => {
  respuesta = { status: 201, cuerpo: { recibido: true, referencia: "CONT-1" } };
  const r = await proxy().enviarReporte(reporte, "lote-8-envio-1");
  assert.deepEqual(r, { ok: true, status: 201, referencia: "CONT-1" });
  assert.equal(ultima.metodo, "POST");
  assert.equal(ultima.url, "/reportes-cierre");
  assert.equal(ultima.headers["idempotency-key"], "lote-8-envio-1");
  assert.equal(ultima.headers.authorization, "Bearer token-prueba");
  assert.deepEqual(ultima.cuerpo, reporte);
});

test("TDSI-420: caida, 5xx o timeout son reintentables; un 4xx es rechazo (no reintentable)", async () => {
  respuesta = { status: 503, cuerpo: { error: "caido" } };
  let r = await proxy().enviarReporte(reporte, "k");
  assert.equal(r.ok, false);
  assert.equal(r.reintentable, true);
  assert.match(r.error, /HTTP 503/);

  respuesta = { status: 422, cuerpo: { error: "rechazado" } };
  r = await proxy().enviarReporte(reporte, "k");
  assert.equal(r.ok, false);
  assert.equal(r.reintentable, false);
  assert.equal(r.status, 422);

  respuesta = { colgar: true };
  r = await proxy().enviarReporte(reporte, "k");
  assert.equal(r.ok, false);
  assert.equal(r.reintentable, true);
  assert.match(r.error, /no respondio/);
});

test("TDSI-420: receptor simulado del modo aislado acepta el reporte o simula la caida", () => {
  const { envioSimulado } = proxy();
  const ok = envioSimulado("lote-8-envio-1", { CONTABILIDAD_SIMULAR_CAIDA: false });
  assert.equal(ok.ok, true);
  assert.equal(ok.referencia, "SIM-lote-8-envio-1");
  const caida = envioSimulado("lote-8-envio-1", { CONTABILIDAD_SIMULAR_CAIDA: true });
  assert.equal(caida.ok, false);
  assert.equal(caida.reintentable, true);
});