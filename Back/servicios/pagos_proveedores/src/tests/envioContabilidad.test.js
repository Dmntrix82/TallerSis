// TDSI-421/422: usa la base real en MODO_AISLADO (Contabilidad simulada) con una fecha
// antigua reservada para pruebas; borrar el lote borra tambien su envio (ON DELETE CASCADE).
process.env.MODO_AISLADO = "true";
process.env.CONTABILIDAD_MAX_INTENTOS = "3";

const test = require("node:test");
const assert = require("node:assert/strict");
const { generarLote } = require("../services/loteCierreService");
const {
  enviarLote, enviarLoteAutomatico, listarEnvios, obtenerEnvio, reenviarEnvio,
} = require("../services/envioContabilidadService");
const enviosRepo = require("../data/enviosContabilidadRepo");
const { procesarPendientes } = require("../jobs/reintentoEnviosContabilidad");
const cfg = require("../config/integraciones");
const { pool } = require("../config/db");

const FECHA = "2000-01-04";
const borrarLote = () => pool.query("DELETE FROM proveedores.lotes_cierre_diario WHERE fecha = $1", [FECHA]);
// Adelanta el proximo intento para no esperar el backoff real en la prueba.
const vencerProximoIntento = (id) =>
  pool.query("UPDATE proveedores.envios_contabilidad SET proximo_intento_en = now() - interval '1 second' WHERE id = $1", [id]);
const loteId = async () =>
  (await pool.query("SELECT id FROM proveedores.lotes_cierre_diario WHERE fecha = $1", [FECHA])).rows[0].id;
const reintentar = async (id) => {
  await vencerProximoIntento(id);
  const [r] = await procesarPendientes({ loteId: await loteId() });
  return r;
};
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

test("TDSI-421/422: si Contabilidad no responde registra el error y queda PENDIENTE para reintentar", async () => {
  cfg.CONTABILIDAD_SIMULAR_CAIDA = true;
  const envio = await enviarLote({ fecha: FECHA });
  assert.equal(envio.estado, "PENDIENTE");
  assert.equal(envio.intentos, 1);
  assert.match(envio.ultimo_error, /fuera de servicio/);
  assert.ok(envio.ultimo_intento_en instanceof Date);
  assert.ok(envio.proximo_intento_en > new Date(), "el proximo intento queda programado a futuro");
  assert.equal(envio.enviado_en, null);
  assert.equal(await estadoLote(), "GENERADO");
});

test("TDSI-422: el worker no reintenta antes de tiempo", async () => {
  cfg.CONTABILIDAD_SIMULAR_CAIDA = true;
  await enviarLote({ fecha: FECHA });
  assert.deepEqual(await procesarPendientes({ loteId: await loteId() }), []);
});

test("TDSI-422: reintenta hasta 3 intentos y luego marca ERROR", async () => {
  cfg.CONTABILIDAD_SIMULAR_CAIDA = true;
  const envio = await enviarLote({ fecha: FECHA }); // intento 1
  const r2 = await reintentar(envio.id);
  assert.equal(r2.intentos, 2);
  assert.equal(r2.estado, "PENDIENTE");
  const r3 = await reintentar(envio.id);
  assert.equal(r3.intentos, 3);
  assert.equal(r3.estado, "ERROR");
  assert.equal(r3.proximo_intento_en, null);
  // ya en ERROR, el worker no lo vuelve a tomar
  await vencerProximoIntento(envio.id);
  assert.deepEqual(await procesarPendientes({ loteId: await loteId() }), []);
  assert.equal((await enviosRepo.obtenerPorId(envio.id)).intentos, 3);
});

test("TDSI-422: si Contabilidad vuelve en un reintento, el envio queda ENVIADO", async () => {
  cfg.CONTABILIDAD_SIMULAR_CAIDA = true;
  const envio = await enviarLote({ fecha: FECHA });
  cfg.CONTABILIDAD_SIMULAR_CAIDA = false;
  const r = await reintentar(envio.id);
  assert.equal(r.estado, "ENVIADO");
  assert.equal(r.intentos, 2);
  assert.equal(r.ultimo_error, null);
  assert.equal(await estadoLote(), "ENVIADO");
});

test("TDSI-422: un rechazo de Contabilidad (4xx) no se reintenta: ERROR al primer intento", async () => {
  const envio = await enviarLote({ fecha: FECHA });
  await pool.query("UPDATE proveedores.envios_contabilidad SET estado = 'PENDIENTE', intentos = 0 WHERE id = $1", [envio.id]);
  const r = await enviosRepo.registrarFallo(envio, { ok: false, status: 422, reintentable: false, error: "HTTP 422" }, 3, 30);
  assert.equal(r.estado, "ERROR");
  assert.equal(r.intentos, 1);
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


test("TDSI-122: reenviar un envio en ERROR lo vuelve a intentar y actualiza su estado", async () => {
  cfg.CONTABILIDAD_SIMULAR_CAIDA = true;
  const envio = await enviarLote({ fecha: FECHA });
  await reintentar(envio.id);
  const enError = await reintentar(envio.id);
  assert.equal(enError.estado, "ERROR");

  cfg.CONTABILIDAD_SIMULAR_CAIDA = false;
  const reenviado = await reenviarEnvio(envio.id, { solicitado_por: "jose" });
  assert.equal(reenviado.id, envio.id, "reutiliza la misma fila");
  assert.equal(reenviado.estado, "ENVIADO");
  assert.equal(reenviado.intentos, 1, "empieza un nuevo ciclo de intentos");
  assert.equal(reenviado.solicitado_por, "jose");
  assert.equal(await estadoLote(), "ENVIADO");
});

test("TDSI-122: reenviar falla otra vez -> nuevo ciclo PENDIENTE con intentos desde 1", async () => {
  cfg.CONTABILIDAD_SIMULAR_CAIDA = true;
  const envio = await enviarLote({ fecha: FECHA });
  await reintentar(envio.id);
  await reintentar(envio.id);
  const r = await reenviarEnvio(envio.id);
  assert.equal(r.estado, "PENDIENTE");
  assert.equal(r.intentos, 1);
});

test("TDSI-122: solo se reenvian envios en ERROR (409), y el id debe existir (404) y ser valido (400)", async () => {
  const envio = await enviarLote({ fecha: FECHA });
  await assert.rejects(
    () => reenviarEnvio(envio.id),
    (e) => e.status === 409 && e.detalle.codigo === "ENVIO_NO_REENVIABLE" && e.detalle.envio.estado === "ENVIADO"
  );
  await assert.rejects(() => reenviarEnvio("999999999999"), (e) => e.status === 404);
  for (const id of ["abc", "0", "-1", "1.5"]) {
    await assert.rejects(() => reenviarEnvio(id), (e) => e.status === 400);
  }
});

test("TDSI-122: lista y filtra envios, y valida los filtros", async () => {
  const envio = await enviarLote({ fecha: FECHA });
  const enviados = await listarEnvios({ estado: "enviado" });
  assert.ok(enviados.envios.some((e) => e.id === envio.id));
  const errores = await listarEnvios({ estado: "ERROR" });
  assert.ok(!errores.envios.some((e) => e.id === envio.id));
  assert.equal(errores.total, errores.envios.length);
  await assert.rejects(() => listarEnvios({ estado: "RARO" }), (e) => e.status === 400);
  await assert.rejects(() => listarEnvios({ limite: "0" }), (e) => e.status === 400);
});

test("TDSI-122: detalle del envio con el reporte enviado", async () => {
  const envio = await enviarLote({ fecha: FECHA });
  const detalle = await obtenerEnvio(envio.id);
  assert.equal(detalle.payload.fecha, FECHA);
  await assert.rejects(() => obtenerEnvio("999999999999"), (e) => e.status === 404);
});

test("TDSI-122: el envio automatico nunca hace fallar la generacion del lote", async () => {
  const lote = (await pool.query("SELECT fecha::text AS fecha, generado_por FROM proveedores.lotes_cierre_diario WHERE fecha = $1", [FECHA])).rows[0];
  const r1 = await enviarLoteAutomatico(lote);
  assert.equal(r1.envio.estado, "ENVIADO");
  // segundo intento automatico del mismo lote: no lanza error, informa el envio existente
  const r2 = await enviarLoteAutomatico(lote);
  assert.match(r2.error, /ya tiene un envio/);
  assert.equal(r2.envio.id, r1.envio.id);
});