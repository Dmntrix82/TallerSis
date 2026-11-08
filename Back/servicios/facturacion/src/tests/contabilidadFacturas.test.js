// TDSI-22: envio de facturas a Contabilidad (Grupo D) con un Pub/Sub simulado (no publica en Google).
// Usa la base real; las facturas de prueba se borran al final (sus envios caen por ON DELETE CASCADE).
process.env.CONTABILIDAD_PUBSUB_TOPIC = "projects/proyecto-prueba/topics/topico-prueba";
process.env.CONTABILIDAD_MAX_INTENTOS = "3";

const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const facturasService = require("../services/facturasService");
const contabilidad = require("../services/contabilidadService");
const { procesarPendientes } = require("../jobs/reintentoEnviosContabilidad");
const { usarClienteDePrueba } = require("../clients/pubsubPublisher");
const cfg = require("../config/contabilidad");
const { pool } = require("../config/db");

const NIT = "7700112233";
const creadas = [];

function clienteFalso() {
  const falso = { publicados: [], fallas: [] };
  falso.topic = () => ({
    publishMessage: async (msg) => {
      const falla = falso.fallas.shift();
      if (falla) throw falla;
      falso.publicados.push(msg);
      return `msg-${falso.publicados.length}`;
    },
  });
  return falso;
}
const errorGrpc = (code, message) => Object.assign(new Error(message), { code });

async function nuevaFactura() {
  const f = await facturasService.crearFactura({
    nit: NIT,
    razon_social: "Ferreteria Prueba S.R.L.",
    items: [
      { descripcion: "Martillo", cantidad: 2, precio_unitario: 45.5 },
      { descripcion: "Clavos 1kg", cantidad: 1, precio_unitario: 19 },
    ],
  });
  creadas.push(f.id);
  await pool.query(
    `INSERT INTO facturacion.factura_metodos_pago (factura_id, metodo, monto) VALUES ($1,'Efectivo',60),($1,'QR',50)`,
    [f.id]
  );
  return f;
}

async function anularAutorizada(facturaId, motivo = "Error en el NIT del cliente") {
  await pool.query(`UPDATE facturacion.facturas SET estado = 'Anulada' WHERE id = $1`, [facturaId]);
  await pool.query(
    `INSERT INTO facturacion.factura_anulaciones
       (factura_id, motivo, solicitado_por, estado, autorizado_por, autorizado_nombre, autorizado_en)
     VALUES ($1, $2, 'cajero1', 'Autorizada', 'SUP-1', 'Supervisor Uno', now())`,
    [facturaId, motivo]
  );
}

const vencer = (id) =>
  pool.query(`UPDATE facturacion.factura_envios_contabilidad SET proximo_intento_en = now() - interval '1 second' WHERE id = $1`, [id]);

let falso;
test.beforeEach(() => {
  cfg.PUBSUB_TOPIC = "projects/proyecto-prueba/topics/topico-prueba";
  falso = clienteFalso();
  usarClienteDePrueba(falso);
});
test.after(async () => {
  usarClienteDePrueba(null);
  if (creadas.length) await pool.query(`DELETE FROM facturacion.facturas WHERE id = ANY($1::bigint[])`, [creadas]);
  await pool.end();
});

test("TDSI-22: al emitir se publica el mensaje 'venta' completo y el envio queda Enviado", async () => {
  const f = await nuevaFactura();
  const envio = await contabilidad.enviarFactura(f.id, "venta");
  assert.equal(envio.estado, "Enviado");
  assert.equal(envio.tipo, "venta");
  assert.equal(envio.pubsub_message_id, "msg-1");
  assert.equal(envio.intentos, 1);

  const [{ json, attributes }] = falso.publicados;
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/La_Paz" });
  // Formato exacto que pide Contabilidad (Grupo D): el cuerpo es lo unico que leen.
  assert.deepEqual(json, {
    sistema_origen: "FACTURACION",
    referencia_externa: f.numero,
    tipo_operacion: "venta",
    fecha_documento: hoy,
    datos: {
      fecha_documento: hoy,
      nit_cliente: NIT,
      nombre_cliente: "Ferreteria Prueba S.R.L.",
      monto: 110,
      condicion_pago: "contado",
      costo_venta: 0,
      monto_descuento: 0,
      modo_impuesto: "incluido",
    },
  });
  assert.deepEqual(attributes, {
    tipo: "FACTURA_VENTA", tipo_operacion: "venta", factura_id: String(f.id), referencia_externa: f.numero,
    idempotency_key: `factura-${f.id}-venta`, origen: "facturacion", grupo: "A",
  });
});

test("TDSI-22: una factura se envia una sola vez por tipo (uq_envio_factura_tipo)", async () => {
  const f = await nuevaFactura();
  const primero = await contabilidad.enviarFactura(f.id, "venta");
  const segundo = await contabilidad.enviarFactura(f.id, "venta");
  assert.equal(segundo.id, primero.id);
  assert.equal(falso.publicados.length, 1);
  const { rows } = await pool.query(`SELECT count(*)::int AS n FROM facturacion.factura_envios_contabilidad WHERE factura_id = $1`, [f.id]);
  assert.equal(rows[0].n, 1);
});

test("TDSI-22: la anulacion se publica como 'anulacion_factura' con referencia propia y la venta original", async () => {
  const f = await nuevaFactura();
  await contabilidad.enviarFactura(f.id, "venta");
  await assert.rejects(contabilidad.enviarFactura(f.id, "anulacion"), { status: 409 });

  await anularAutorizada(f.id);
  const envio = await contabilidad.enviarFactura(f.id, "anulacion");
  assert.equal(envio.estado, "Enviado");
  assert.equal(envio.tipo, "anulacion"); // tipo de la tabla (CHECK venta/anulacion)

  const { json, attributes } = falso.publicados[1];
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/La_Paz" });
  assert.deepEqual(json, {
    sistema_origen: "FACTURACION",
    referencia_externa: `ANU-${f.numero}`,
    tipo_operacion: "anulacion_factura",
    fecha_documento: hoy,
    datos: { id_documento_original: f.numero, tipo_documento_original: "venta", motivo: "Error en el NIT del cliente" },
  });
  assert.equal(attributes.tipo, "FACTURA_ANULACION");
  assert.equal(attributes.tipo_operacion, "anulacion_factura");
  const { rows } = await pool.query(
    `SELECT tipo FROM facturacion.factura_envios_contabilidad WHERE factura_id = $1 ORDER BY tipo DESC`, [f.id]);
  assert.deepEqual(rows.map((r) => r.tipo), ["venta", "anulacion"]);
});

test("TDSI-22: la anulacion espera (sin gastar intentos) hasta que la venta llegue a Contabilidad", async () => {
  const f = await nuevaFactura();
  falso.fallas.push(errorGrpc(14, "14 UNAVAILABLE"));
  const venta = await contabilidad.enviarFactura(f.id, "venta");
  assert.equal(venta.estado, "Pendiente");

  await anularAutorizada(f.id);
  const anulacion = await contabilidad.enviarFactura(f.id, "anulacion");
  assert.equal(anulacion.estado, "Pendiente");
  assert.equal(anulacion.intentos, 0);
  assert.match(anulacion.ultimo_error, /Esperando que la venta/);
  assert.equal(falso.publicados.length, 0);

  // el worker publica primero la venta y despues la anulacion
  await vencer(venta.id);
  await vencer(anulacion.id);
  await procesarPendientes({ facturaId: f.id });
  await vencer(anulacion.id);
  await procesarPendientes({ facturaId: f.id });
  assert.deepEqual(falso.publicados.map((m) => m.json.tipo_operacion), ["venta", "anulacion_factura"]);
});

test("TDSI-22: al anular una factura que nunca se envio, primero se envia su venta", async () => {
  const f = await nuevaFactura();
  await anularAutorizada(f.id);
  const envio = await contabilidad.enviarFactura(f.id, "anulacion");
  assert.equal(envio.estado, "Enviado");
  assert.deepEqual(falso.publicados.map((m) => m.json.tipo_operacion), ["venta", "anulacion_factura"]);
});

test("TDSI-22: rechaza enviar una anulacion con motivo de menos de 10 caracteres", async () => {
  const f = await nuevaFactura();
  await contabilidad.enviarFactura(f.id, "venta");
  await anularAutorizada(f.id, "Corto"); // anulacion vieja con motivo corto
  await assert.rejects(contabilidad.enviarFactura(f.id, "anulacion"), { status: 422 });
});

test("TDSI-22: si Pub/Sub no responde queda Pendiente y el worker lo publica despues", async () => {
  const f = await nuevaFactura();
  falso.fallas.push(errorGrpc(14, "14 UNAVAILABLE"));
  const envio = await contabilidad.enviarFactura(f.id, "venta");
  assert.equal(envio.estado, "Pendiente");
  assert.match(envio.ultimo_error, /UNAVAILABLE/);

  await vencer(envio.id);
  const [r] = await procesarPendientes({ facturaId: f.id });
  assert.equal(r.estado, "Enviado");
  assert.equal(r.intentos, 2);
  assert.equal(r.pubsub_message_id, "msg-1");
});

test("TDSI-22: sin permiso queda en Error; se lista y se puede reenviar", async () => {
  const f = await nuevaFactura();
  falso.fallas.push(errorGrpc(7, "7 PERMISSION_DENIED"));
  const envio = await contabilidad.enviarFactura(f.id, "venta");
  assert.equal(envio.estado, "Error");

  const { envios } = await contabilidad.listarEnvios({ estado: "error", tipo: "venta" });
  assert.ok(envios.some((e) => e.id === envio.id));
  await assert.rejects(contabilidad.listarEnvios({ estado: "OTRO" }), { status: 400 });

  const reenviado = await contabilidad.reenviarEnvio(envio.id);
  assert.equal(reenviado.estado, "Enviado");
  await assert.rejects(contabilidad.reenviarEnvio(envio.id), { status: 409 });
});

test("TDSI-22: sin topico configurado no registra ni publica nada", async () => {
  cfg.PUBSUB_TOPIC = null;
  const f = await nuevaFactura();
  const r = await contabilidad.enviarFactura(f.id, "venta");
  assert.equal(r.publicado, false);
  assert.equal(falso.publicados.length, 0);
});

test("TDSI-22: POST /api/facturas crea la factura y responde con el envio a Contabilidad", async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/facturas", require("../routes/facturacionRoutes"));
  app.use(require("../middlewares/errorHandler").errorHandler);
  const server = app.listen(0);
  const base = `http://localhost:${server.address().port}/api/facturas`;
  try {
    const res = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nit: NIT, razon_social: "Ferreteria Prueba S.R.L.", items: [{ descripcion: "Pala", cantidad: 1, precio_unitario: 80 }] }),
    });
    const cuerpo = await res.json();
    creadas.push(cuerpo.data.id);
    assert.equal(res.status, 201);
    assert.equal(cuerpo.contabilidad.estado, "Enviado");
    assert.equal(cuerpo.contabilidad.tipo, "venta");

    // Pub/Sub caido: la factura se crea igual (201) y el envio queda Pendiente
    falso.fallas.push(errorGrpc(14, "14 UNAVAILABLE"));
    const res2 = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nit: NIT, razon_social: "Ferreteria Prueba S.R.L.", items: [{ descripcion: "Pico", cantidad: 1, precio_unitario: 70 }] }),
    });
    const cuerpo2 = await res2.json();
    creadas.push(cuerpo2.data.id);
    assert.equal(res2.status, 201);
    assert.equal(cuerpo2.contabilidad.estado, "Pendiente");

    const lista = await (await fetch(`${base}/envios-contabilidad?tipo=venta&limite=5`)).json();
    assert.ok(lista.data.envios.some((e) => e.factura_numero === cuerpo.data.numero));
  } finally {
    server.close();
  }
});

test("TDSI-22: la fecha del documento es la de Bolivia y el descuento va en monto_descuento", () => {
  const { armarMensaje } = contabilidad;
  const m = armarMensaje({
    tipo: "venta",
    factura: { numero: "F-000099", fecha: new Date("2026-10-21T02:30:00Z"), cliente_nit: null, cliente_nombre: null, total: "35.00", descuento: "5.50" },
  });
  assert.equal(m.fecha_documento, "2026-10-20"); // 22:30 del 20 en Bolivia
  assert.equal(m.datos.fecha_documento, "2026-10-20");
  assert.equal(m.datos.nombre_cliente, "Consumidor final");
  assert.equal(m.datos.nit_cliente, null);
  assert.equal(m.datos.monto, 35);
  assert.equal(m.datos.monto_descuento, 5.5);
});
