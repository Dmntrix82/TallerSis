require("dotenv").config();
const express = require("express");
const pagosRoutes = require("./routes/pagosRoutes");
const pagoMixtoRoutes = require("./routes/pagoMixtoRoutes");
const { errorHandler } = require("./middlewares/errorHandler");
const { query } = require("./config/db");
const authRoutes = require("./routes/authRoutes");

const app = express();
const port = process.env.PORT || 4005;

app.use(express.json());
app.use("/auth", authRoutes); // TDSI-11
app.get("/health", async (req, res) => {
  try {
    await query("SELECT 1");
    res.json({ ok: true, db: "up" });
  } catch (e) {
    res.status(503).json({ ok: false, db: "down", mensaje: e.message });
  }
});

app.use("/api/pagos", pagosRoutes);
app.use("/api/pagos", pagoMixtoRoutes);

app.use(errorHandler);

app.listen(port, () => {
  console.log(`Microservicio de Pagos corriendo en el puerto ${port}`);
});