// TDSI-636: receptor simulado del modulo de Contabilidad para probar con MODO_AISLADO=false.
//   npm run mock-contabilidad            (puerto 4998)
//   POST /modo/ok | /modo/caido | /modo/lento | /modo/raro
//   POST /periodos/2026-09/cerrar  y  /periodos/2026-09/abrir
const express = require("express");

const app = express();
let modo = process.env.MODO || "ok";
const cerrados = new Set(String(process.env.CERRADOS || "").split(",").filter(Boolean));

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