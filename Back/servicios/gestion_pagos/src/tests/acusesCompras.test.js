// TDSI-54/697: suscripcion al topico "compras-acuses" que marca Recibido un envio de
// pagos.envios_compras. Pub/Sub simulado; BD real.
process.env.COMPRAS_ACUSES_SUBSCRIPTION = "projects/proyecto-prueba/subscriptions/sub-acuses";

const test = require("node:test");
const assert = require("node:assert/strict");
const { query, pool } = require("../config/db");
const { interpretar } = require("../services/acusesComprasService");
const { procesarAcuses } = require("../jobs/acusesCompras");
const subscriber = require("../clients/pubsubSubscriber");

const FECHA = "2021-10-20";
const FECHA2 = "2021-10-21";

const acuse = (reporteId, extra = {}) => JSON.stringify({ origen: "compras", reporte_id: reporteId, ...extra });

function suscripcionFalsa(textos) {
  const falsa = { confirmados: [], liberados: [] };
  falsa.pull = async () => [{
    receivedMessages: textos.map((t, i) => ({
      ackId: `ack-${i}`,
      message: { messageId: `m-${i}`, data: Buffer.from(t), attributes: {}, publishTime: { seconds: 1760900000, nanos: 0 } },
    })),
  }];
  falsa.acknowledge = async ({ ackIds }) => falsa.confirmados.push(...ackIds);
  falsa.modifyAckDeadline = async ({ ackIds }) => falsa.liberados.push(...ackIds);
  falsa.close = async () => {};
  return falsa;
}

async function envioEnviado(fecha) {
  await query(
    `INSERT INTO pagos.envios_compras (fecha, reporte_id, estado, enviado_en)
     VALUES ($1, $2, 'Enviado', now())
     ON CONFLICT (fecha) DO UPDATE SET estado = 'Enviado', recibido_en = NULL`,
    [fecha, `PV-${fecha}`]
  );
}

test.after(async () => {
  subscriber.usarClienteDePrueba(null);
  await query(`DELETE FROM pagos.envios_compras WHERE fecha = ANY($1::date[])`, [[FECHA, FECHA2]]);
  await pool.end();
});

test("TDSI-697: interpreta el acuse de Compras para referencias PV-<fecha>", () => {
  assert.deepEqual(interpretar(acuse(`PV-${FECHA}`)), { reporteId: `PV-${FECHA}`, fecha: FECHA });

  assert.equal(interpretar("no es json"), null);
  assert.equal(interpretar(JSON.stringify({ reporte_id: `PV-${FECHA}` })), null); // sin origen "compras"
  assert.equal(interpretar(acuse("F-000001")), null); // no es nuestra referencia
  assert.equal(interpretar(JSON.stringify({ origen: "otro-sistema", reporte_id: `PV-${FECHA}` })), null);
});

test("TDSI-697: marca Recibido el envio y confirma solo los acuses reconocibles", async () => {
  await envioEnviado(FECHA);
  const falsa = suscripcionFalsa([
    acuse(`PV-${FECHA}`),
    JSON.stringify({ otro: true }), // mensaje que no es un acuse nuestro
  ]);
  subscriber.usarClienteDePrueba(falsa);

  const resultados = await procesarAcuses();
  assert.equal(resultados.length, 1);
  assert.equal(resultados[0].reporteId, `PV-${FECHA}`);
  assert.deepEqual(falsa.confirmados, ["ack-0"]);
  assert.deepEqual(falsa.liberados, ["ack-1"]);

  const { rows } = await query(`SELECT estado, recibido_en IS NOT NULL AS con_fecha FROM pagos.envios_compras WHERE fecha = $1`, [FECHA]);
  assert.deepEqual(rows[0], { estado: "Recibido", con_fecha: true });
});

test("TDSI-697: un acuse para una fecha que no tenemos igual se confirma (es nuestro, no sirve reintentarlo)", async () => {
  const falsa = suscripcionFalsa([acuse(`PV-${FECHA2}`)]);
  subscriber.usarClienteDePrueba(falsa);

  const resultados = await procesarAcuses();
  assert.equal(resultados.length, 1);
  assert.deepEqual(falsa.confirmados, ["ack-0"]);

  const { rows } = await query(`SELECT 1 FROM pagos.envios_compras WHERE fecha = $1`, [FECHA2]);
  assert.equal(rows.length, 0, "no crea un envio de la nada, solo actualiza uno existente");
});
