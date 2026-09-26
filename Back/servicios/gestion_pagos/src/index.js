require("dotenv").config();
const express = require("express");
const pagosRoutes = require("./routes/pagosRoutes");
const pagoMixtoRoutes = require("./routes/pagoMixtoRoutes");
const authRoutes = require("./routes/authRoutes");
const ventaOnlineRoutes = require("./routes/ventaOnlineRoutes");
const tableroRoutes = require("./routes/tableroRoutes");
const { errorHandler } = require("./middlewares/errorHandler");
const { query } = require("./config/db");


const app = express();
const port = process.env.PORT || 4005;

// ⬇️ MIDDLEWARE GLOBAL PRIMERO
app.use(express.json());

app.get("/health", async (req, res) => {
  try {
    await query("SELECT 1");
    res.json({ ok: true, db: "up" });
  } catch (e) {
    res.status(503).json({ ok: false, db: "down", mensaje: e.message });
  }
});

// ⬇️ RUTAS DESPUÉS
app.use("/api/pagos", pagosRoutes);
app.use("/api/pagos", pagoMixtoRoutes);
app.use("/api/pagos", ventaOnlineRoutes);
app.use("/api/tablero", tableroRoutes);
app.use("/auth", authRoutes);
app.use("/transacciones", require("./routes/transaccionesEstadoRoutes")); // TDSI-14

app.use(errorHandler);

app.listen(port, () => {
  console.log(`Microservicio de Pagos corriendo en el puerto ${port}`);
});