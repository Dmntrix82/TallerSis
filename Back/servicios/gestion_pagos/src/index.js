require("dotenv").config();
const express = require("express");
const cors = require("cors");
const pagosRoutes = require("./routes/pagosRoutes");
const pagoMixtoRoutes = require("./routes/pagoMixtoRoutes");
const ventaOnlineRoutes = require("./routes/ventaOnlineRoutes");
const authRoutes = require("./routes/authRoutes");
const tableroRoutes = require("./routes/tableroRoutes");
const facturaDocumentoRoutes = require("./routes/facturaDocumentoRoutes");
const { errorHandler } = require("./middlewares/errorHandler");
const { query } = require("./config/db");

const app = express();
const port = process.env.PORT || 4005;

// ⬇️ MIDDLEWARE GLOBAL PRIMERO
// Permite que el Frontend (Vite en localhost:5173, u otro origen en produccion) consuma este WS.
app.use(cors());
app.use(express.json());

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
app.use("/api/pagos", ventaOnlineRoutes);
app.use("/auth", authRoutes);
app.use("/transacciones", require("./routes/transaccionesEstadoRoutes")); // TDSI-14
app.use("/api/tablero", tableroRoutes); // TDSI-16
app.use("/api/facturas", facturaDocumentoRoutes); // TDSI-108

app.use(errorHandler);

app.listen(port, () => {
  console.log(`Microservicio de Pagos corriendo en el puerto ${port}`);
});