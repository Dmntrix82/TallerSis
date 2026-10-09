// TDSI-636: proxy de Contabilidad contra un receptor HTTP levantado en la prueba (no usa la BD).
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

let servidor;
let respuesta = { status: 200, cuerpo: { periodo: "2026-10", estado: "ABIERTO" } };
let ultimaUrl = null;

test.before(async () => {
  servidor = http.createServer((req, res) => {
    ultimaUrl = req.url;
    if (respuesta.colgar) return; // nunca responde -> timeout
    res.writeHead(respuesta.status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(respuesta.cuerpo));
  });
  await new Promise((ok) => servidor.listen(0, ok));
  process.env.MODO_AISLADO = "false";
  process.env.CONTABILIDAD_URL = `http://localhost:${servidor.address().port}`;
  process.env.INTEGRACIONES_TIMEOUT_MS = "500";
});

test.after(() => {
  servidor.closeAllConnections();
  servidor.close();
});

const proxy = () => require("../clients/contabilidadProxy");

test("TDSI-636: consulta el periodo de la fecha y lo informa ABIERTO", async () => {
  const r = await proxy().consultarPeriodoContable("2026-10-08");
  assert.equal(ultimaUrl, "/periodos-contables/estado?fecha=2026-10-08");
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