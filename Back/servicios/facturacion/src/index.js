require("dotenv").config();
const express = require("express");
const facturacionRoutes = require("./routes/facturacionRoutes");
const clientesRoutes = require("./routes/clientesRoutes");
const anulacionesRoutes = require("./routes/anulacionesRoutes");       
const { errorHandler } = require("./middlewares/errorHandler");
const { query } = require("./config/db");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4002;

app.get("/facturacion", (req, res) => {
  res.json({ mensaje: "Microservicio de Facturacion funcionando", estado: "activo" });
});

app.get("/health", async (req, res) => {
  try {
    await query("SELECT 1");
    res.json({ ok: true, db: "up" });
  } catch (e) {
    res.status(503).json({ ok: false, db: "down", mensaje: e.message });
  }
});

app.use("/api/facturas", facturacionRoutes);
app.use("/api/clientes", clientesRoutes);
app.use("/anulaciones", anulacionesRoutes); 

app.use(errorHandler);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Facturacion ejecutandose en el puerto ${PORT}`);
});