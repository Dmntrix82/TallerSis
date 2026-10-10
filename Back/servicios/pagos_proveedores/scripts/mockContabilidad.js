// TDSI-636/420: receptor simulado del modulo de Contabilidad para probar con MODO_AISLADO=false.
//   npm run mock-contabilidad            (puerto 4998)
//   POST /modo/ok | /modo/caido | /modo/lento | /modo/raro | /modo/rechaza
//   POST /periodos/2026-09/cerrar  y  /periodos/2026-09/abrir
//   GET  /reportes-cierre  -> reportes recibidos
const express = require("express");

const app = express();
app.use(express.json({ limit: "1mb" }));
let modo = process.env.MODO || "ok";
const cerrados = new Set(String(process.env.CERRADOS || "").split(",").filter(Boolean));
const reportes = new Map(); // Idempotency-Key -> { referencia, reporte }

app.get("/periodos-contables/estado", (req, res) => {
  const fecha = String(req.query.fecha || "");
  const periodo = fecha.slice(0, 7);
  console.log(`[Contabilidad] modo=${modo} fecha=${fecha}`);
  if (modo === "caido") return res.status(503).json({ error: "Servicio no disponible" });
  if (modo === "lento") return setTimeout(() => res.json({ periodo, estado: "ABIERTO" }), 60000);
  if (modo === "raro") return res.json({ hola: "mundo" });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return res.status(400).json({ error: "fecha invalida" });
  res.json({ periodo, estado: cerrados.has(periodo) ? "CERRADO" : "ABIERTO" });
});

// TDSI-420: recepcion del reporte del Lote de Cierre Diario
app.post("/reportes-cierre", (req, res) => {
  const key = req.get("Idempotency-Key");
  console.log(`[Contabilidad] reporte modo=${modo} key=${key} fecha=${req.body?.fecha}`);
  if (modo === "caido") return res.status(503).json({ error: "Servicio no disponible" });
  if (modo === "lento") return setTimeout(() => res.status(201).json({ recibido: true }), 60000);
  if (modo === "rechaza") return res.status(422).json({ error: "Reporte rechazado por Contabilidad" });
  if (!key) return res.status(400).json({ error: "Falta Idempotency-Key" });
  if (req.body?.tipo !== "REPORTE_CIERRE_DIARIO") return res.status(400).json({ error: "tipo de reporte invalido" });

  // Mismo Idempotency-Key = mismo reporte: no se registra dos veces.
  if (reportes.has(key)) return res.status(200).json({ recibido: true, referencia: reportes.get(key).referencia });
  const referencia = `CONT-${reportes.size + 1}`;
  reportes.set(key, { referencia, reporte: req.body });
  res.status(201).json({ recibido: true, referencia });
});

app.get("/reportes-cierre", (req, res) => {
  res.json([...reportes.entries()].map(([key, r]) => ({ key, referencia: r.referencia, fecha: r.reporte.fecha })));
});

app.post("/modo/:m", (req, res) => {
  modo = req.params.m;
  console.log(`[Contabilidad] modo cambiado a ${modo}`);
  res.json({ modo });
});

app.post("/periodos/:periodo/:accion", (req, res) => {
  const { periodo, accion } = req.params;
  if (accion === "cerrar") cerrados.add(periodo);
  else if (accion === "abrir") cerrados.delete(periodo);
  else return res.status(400).json({ error: "accion debe ser cerrar o abrir" });
  console.log(`[Contabilidad] periodos cerrados: ${[...cerrados].join(", ") || "(ninguno)"}`);
  res.json({ periodo, cerrados: [...cerrados] });
});

app.listen(4998, () => console.log(`[Contabilidad] Simulador en http://localhost:4998 (modo ${modo})`));