require("dotenv").config();
const express = require("express");
const turnosRoutes = require("./routes/turnosRoutes");
const { errorHandler } = require("./middlewares/errorHandler");
const { query } = require("./config/db");

const app = express();
const port = process.env.PORT || 4004;

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

app.listen(port, () => {
  console.log(`Gestion de Caja ejecutandose en el puerto ${port}`);
});