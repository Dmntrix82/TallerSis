require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { query } = require("./config/db");
const { errorHandler } = require("./middlewares/errorHandler");
const egresosRoutes = require("./routes/egresosRoutes");
const confirmacionesRoutes = require("./routes/confirmacionesRoutes");

const app = express();

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

app.use("/api/egresos", egresosRoutes);
app.use("/ordenes-pago", confirmacionesRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 4006;
app.listen(PORT, () => {
  console.log(`[PagosProveedores] Servidor corriendo en puerto ${PORT}`);
});