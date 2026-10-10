// TDSI-421: usa la base real en MODO_AISLADO (Contabilidad simulada) con una fecha
// antigua reservada para pruebas; borrar el lote borra tambien su envio (ON DELETE CASCADE).
process.env.MODO_AISLADO = "true";

const test = require("node:test");
const assert = require("node:assert/strict");
const { generarLote } = require("../services/loteCierreService");
const { enviarLote } = require("../services/envioContabilidadService");
const enviosRepo = require("../data/enviosContabilidadRepo");
const cfg = require("../config/integraciones");
const { pool } = require("../config/db");

const FECHA = "2000-01-04";
const borrarLote = () => pool.query("DELETE FROM proveedores.lotes_cierre_diario WHERE fecha = $1", [FECHA]);
const estadoLote = async () =>
  (await pool.query("SELECT estado FROM proveedores.lotes_cierre_diario WHERE fecha = $1", [FECHA])).rows[0].estado;

test.beforeEach(async () => {
  cfg.CONTABILIDAD_SIMULAR_CAIDA = false;
  await borrarLote();
  await generarLote({ fecha: FECHA, generado_por: "admin.prueba" });
});
test.after(async () => {
  await borrarLote();
  await pool.end();
});

test("TDSI-421: registra el envio como ENVIADO, con intentos, fecha y referencia, y marca el lote ENVIADO", async () => {
  const envio = await enviarLote({ fecha: FECHA, solicitado_por: "jose" });
  assert.equal(envio.estado, "ENVIADO");
  assert.equal(envio.intentos, 1);
  assert.equal(envio.fecha, FECHA);
  assert.equal(envio.solicitado_por, "jose");
  assert.equal(envio.referencia_contabilidad, `SIM-envio-${envio.id}`);
  assert.equal(envio.ultimo_error, null);
  assert.ok(envio.ultimo_intento_en instanceof Date);
  assert.ok(envio.enviado_en instanceof Date);
  assert.equal(await estadoLote(), "ENVIADO");
});

test("TDSI-421: guarda el reporte enviado (payload) junto al envio", async () => {
  const envio = await enviarLote({ fecha: FECHA });
  const conPayload = await enviosRepo.obtenerPorId(envio.id, { conPayload: true });
  assert.equal(conPayload.payload.tipo, "REPORTE_CIERRE_DIARIO");
  assert.equal(conPayload.payload.fecha, FECHA);
  assert.equal(conPayload.solicitado_por, "admin.prueba"); // sin solicitado_por usa quien genero el lote
});

test("TDSI-421: si Contabilidad no responde registra el ERROR con su mensaje y el lote sigue GENERADO", async () => {
  cfg.CONTABILIDAD_SIMULAR_CAIDA = true;
  const envio = await enviarLote({ fecha: FECHA });
  assert.equal(envio.estado, "ERROR");
  assert.equal(envio.intentos, 1);
  assert.match(envio.ultimo_error, /fuera de servicio/);
  assert.ok(envio.ultimo_intento_en instanceof Date);
  assert.equal(envio.enviado_en, null);
  assert.equal(await estadoLote(), "GENERADO");
});

test("TDSI-421: un lote tiene un solo envio (409 con el envio existente)", async () => {
  const primero = await enviarLote({ fecha: FECHA });
  await assert.rejects(
    () => enviarLote({ fecha: FECHA }),
    (e) => e.status === 409 && e.detalle.codigo === "ENVIO_EXISTENTE" && e.detalle.envio.id === primero.id
  );
});

test("TDSI-421: no se puede enviar una fecha sin lote (404)", async () => {
  await assert.rejects(() => enviarLote({ fecha: "2000-01-05" }), (e) => e.status === 404);
});

test("TDSI-421: lista los envios registrados", async () => {
  const envio = await enviarLote({ fecha: FECHA });
  const lista = await enviosRepo.listar();
  assert.ok(lista.some((e) => e.id === envio.id && e.fecha === FECHA && e.estado === "ENVIADO"));
  assert.ok(lista.every((e) => e.payload === undefined), "la lista no carga el reporte completo");
});