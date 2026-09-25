require("dotenv").config();
const express = require("express");
const turnosRoutes = require("./routes/turnosRoutes");
const { errorHandler } = require("./middlewares/errorHandler");
const { query } = require("./config/db");

const app = express();
const PORT = process.env.PORT || 4004;

app.use(express.json());

app.get("/health", async (req, res) => {
  try {
    await query("SELECT 1");
    res.json({ ok: true, db: "up" });
  } catch (e) {
    res.status(503).json({ ok: false, db: "down", mensaje: e.message });
  }
});

app.use("/api/caja", turnosRoutes);

app.use(errorHandler);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Gestión de Caja ejecutándose en el puerto ${PORT}`);
});