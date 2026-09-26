const express = require("express");

const app = express();
app.use(express.json());
let modo = process.env.MODO || "ok";

app.post("/confirmaciones-pago", (req, res) => {
  console.log(`[Compras] modo=${modo} key=${req.get("Idempotency-Key")}`, req.body);
  if (modo === "caido") return res.status(503).json({ error: "Servicio no disponible" });
  if (modo === "rechaza") return res.status(422).json({ error: "Orden desconocida en Compras" });
  res.status(201).json({ recibido: true });
});

app.post("/modo/:m", (req, res) => {
  modo = req.params.m;
  console.log(`[Compras] modo cambiado a ${modo}`);
  res.json({ modo });
});

app.listen(4999, () => console.log(`[Compras] Simulador en http://localhost:4999 (modo ${modo})`));