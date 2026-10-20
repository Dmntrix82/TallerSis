// TDSI-656: envio del reporte por Pub/Sub con un cliente simulado (no publica en Google).
// Usa la base real con una fecha reservada para pruebas; borrar el lote borra su envio.
process.env.MODO_AISLADO = "true";
process.env.CONTABILIDAD_MAX_INTENTOS = "3";
process.env.PUBSUB_TOPIC = "projects/proyecto-prueba/topics/topico-prueba";

const test = require("node:test");
const assert = require("node:assert/strict");
const { generarLote } = require("../services/loteCierreService");
const { enviarLote, reenviarEnvio } = require("../services/envioContabilidadService");
const { procesarPendientes } = require("../jobs/reintentoEnviosContabilidad");
const { publicarReporte, usarClienteDePrueba } = require("../clients/pubsubPublisher");
const cfg = require("../config/integraciones");
const { pool } = require("../config/db");

const FECHA = "2000-01-05";
const TOPICO = "projects/proyecto-prueba/topics/topico-prueba";

// Cliente falso: guarda lo publicado y responde segun `fallas` (lista de errores a lanzar en orden).
function clienteFalso() {
  const falso = { publicados: [], topicosPedidos: [], fallas: [], demora: 0 };
  falso.topic = (nombre) => {
    falso.topicosPedidos.push(nombre);
    return {
      publishMessage: async (msg) => {
        if (falso.demora) await new Promise((r) => setTimeout(r, falso.demora));
        const falla = falso.fallas.shift();
        if (falla) throw falla;
        falso.publicados.push(msg);
        return `msg-${falso.publicados.length}`;
      },
    };
  };
  return falso;
}
const errorGrpc = (code, message) => Object.assign(new Error(message), { code });

let falso;
const borrarLote = () => pool.query("DELETE FROM proveedores.lotes_cierre_diario WHERE fecha = $1", [FECHA]);
const loteId = async () =>
  (await pool.query("SELECT id FROM proveedores.lotes_cierre_diario WHERE fecha = $1", [FECHA])).rows[0].id;
const reintentar = async (id) => {
  await pool.query("UPDATE proveedores.envios_contabilidad SET proximo_intento_en = now() - interval '1 second' WHERE id = $1", [id]);
  const [r] = await procesarPendientes({ loteId: await loteId() });
  return r;
};

test.beforeEach(async () => {
  cfg.PUBSUB_TOPIC = TOPICO;
  cfg.PUBSUB_TIMEOUT_MS = 10000;
  falso = clienteFalso();
  usarClienteDePrueba(falso);
  await borrarLote();
  await generarLote({ fecha: FECHA, generado_por: "admin.prueba" });
});
test.after(async () => {
  usarClienteDePrueba(null);
  await borrarLote();
  await pool.end();
});

test("TDSI-656: publica el reporte en el topico y el envio queda ENVIADO con el messageId", async () => {
  const envio = await enviarLote({ fecha: FECHA, solicitado_por: "jose" });
  assert.equal(envio.estado, "ENVIADO");
  assert.equal(envio.canal, "PUBSUB");
  assert.equal(envio.pubsub_message_id, "msg-1");
  assert.equal(envio.referencia_contabilidad, "msg-1");
  assert.equal(envio.intentos, 1);
  assert.deepEqual(falso.topicosPedidos, [TOPICO]);

  const [msg] = falso.publicados;
  assert.equal(msg.json.tipo, "REPORTE_CIERRE_DIARIO");
  assert.equal(msg.json.fecha, FECHA);
  assert.deepEqual(msg.attributes, {
    tipo: "REPORTE_CIERRE_DIARIO",
    fecha: FECHA,
    envio_id: String(envio.id),
    idempotency_key: `envio-${envio.id}`,
    origen: "pagos_proveedores",
    grupo: "A",
  });
  const lote = await pool.query("SELECT estado FROM proveedores.lotes_cierre_diario WHERE fecha = $1", [FECHA]);
  assert.equal(lote.rows[0].estado, "ENVIADO");
});

test("TDSI-656: el mensaje publicado es el mismo reporte guardado en el envio", async () => {
  const envio = await enviarLote({ fecha: FECHA });
  const { rows } = await pool.query("SELECT payload FROM proveedores.envios_contabilidad WHERE id = $1", [envio.id]);
  assert.deepEqual(falso.publicados[0].json, rows[0].payload);
});

test("TDSI-656: si Pub/Sub no esta disponible queda PENDIENTE y el worker lo publica despues", async () => {
  falso.fallas.push(errorGrpc(14, "14 UNAVAILABLE: no connection"));
  const envio = await enviarLote({ fecha: FECHA });
  assert.equal(envio.estado, "PENDIENTE");
  assert.equal(envio.canal, "PUBSUB");
  assert.equal(envio.pubsub_message_id, null);
  assert.match(envio.ultimo_error, /UNAVAILABLE/);

  const r = await reintentar(envio.id);
  assert.equal(r.estado, "ENVIADO");
  assert.equal(r.intentos, 2);
  assert.equal(r.pubsub_message_id, "msg-1");
  assert.equal(r.ultimo_error, null);
});

test("TDSI-656: sin permiso sobre el topico queda en ERROR sin reintentar, y se puede reenviar", async () => {
  falso.fallas.push(errorGrpc(7, "7 PERMISSION_DENIED: User not authorized"));
  const envio = await enviarLote({ fecha: FECHA });
  assert.equal(envio.estado, "ERROR");
  assert.equal(envio.intentos, 1);
  assert.match(envio.ultimo_error, /PERMISSION_DENIED/);
  assert.deepEqual(await procesarPendientes({ loteId: await loteId() }), []);

  const reenviado = await reenviarEnvio(envio.id, { solicitado_por: "jose" });
  assert.equal(reenviado.estado, "ENVIADO");
  assert.equal(reenviado.pubsub_message_id, "msg-1");
});

test("TDSI-656: si Pub/Sub tarda mas que PUBSUB_TIMEOUT_MS el intento falla y se reintenta", async () => {
  cfg.PUBSUB_TIMEOUT_MS = 50;
  falso.demora = 200;
  const envio = await enviarLote({ fecha: FECHA });
  assert.equal(envio.estado, "PENDIENTE");
  assert.match(envio.ultimo_error, /no respondio en 50 ms/);
});

test("TDSI-656: agota los intentos y queda en ERROR", async () => {
  for (let i = 0; i < 3; i++) falso.fallas.push(errorGrpc(14, "14 UNAVAILABLE"));
  const envio = await enviarLote({ fecha: FECHA });
  assert.equal((await reintentar(envio.id)).estado, "PENDIENTE");
  const ultimo = await reintentar(envio.id);
  assert.equal(ultimo.estado, "ERROR");
  assert.equal(ultimo.intentos, 3);
  assert.equal(falso.publicados.length, 0);
});

test("TDSI-656: sin PUBSUB_TOPIC el envio va por HTTP (Contabilidad simulada)", async () => {
  cfg.PUBSUB_TOPIC = null;
  const envio = await enviarLote({ fecha: FECHA });
  assert.equal(envio.estado, "ENVIADO");
  assert.equal(envio.canal, "HTTP");
  assert.equal(envio.pubsub_message_id, null);
  assert.equal(falso.publicados.length, 0);
});

test("TDSI-656: publicarReporte convierte los atributos a texto y omite los vacios", async () => {
  const r = await publicarReporte({ a: 1 }, { n: 5, vacio: null, sinValor: undefined, b: true });
  assert.deepEqual(r, { ok: true, messageId: "msg-1" });
  assert.deepEqual(falso.publicados[0].attributes, { n: "5", b: "true" });
});

test("TDSI-656: GOOGLE_CREDENTIALS_JSON acepta JSON en una linea, con saltos reales o en base64", () => {
  const { execFileSync } = require("node:child_process");
  const llave = { type: "service_account", project_id: "proyecto-x", client_email: "pub@proyecto-x.iam.gserviceaccount.com",
    private_key: "-----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----\n" };
  const leer = (valor) => JSON.parse(execFileSync(process.execPath, ["-e",
    "process.stdout.write(JSON.stringify(require('./src/config/integraciones').GOOGLE_CREDENTIALS))"],
    { env: { ...process.env, GOOGLE_CREDENTIALS_JSON: valor }, cwd: require("node:path").join(__dirname, "../..") }).toString());
  const esperado = { project_id: "proyecto-x", client_email: llave.client_email, private_key: llave.private_key };

  const enUnaLinea = JSON.stringify(llave);
  assert.deepEqual(leer(enUnaLinea), esperado);
  assert.deepEqual(leer(enUnaLinea.replace(/\\n/g, "\n")), esperado); // como lo deja dotenv con comillas dobles
  assert.deepEqual(leer(Buffer.from(JSON.stringify(llave, null, 2)).toString("base64")), esperado);
  assert.throws(() => leer("{no es json"), /no es un JSON valido/);
});

test("TDSI-656: verificarPermiso informa si la cuenta puede publicar en el topico", async () => {
  const { verificarPermiso } = require("../clients/pubsubPublisher");
  let permitido = true;
  usarClienteDePrueba({ topic: () => ({ iam: { testPermissions: async (p) => [{ [p[0]]: permitido }] } }) });
  assert.deepEqual(await verificarPermiso(), { ok: true });
  permitido = false;
  assert.match((await verificarPermiso()).error, /no tiene permiso/);
});
