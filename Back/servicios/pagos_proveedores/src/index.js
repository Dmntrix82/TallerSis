require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { query } = require("./config/db");
const { errorHandler } = require("./middlewares/errorHandler");
const egresosRoutes = require("./routes/egresosRoutes");
const confirmacionesRoutes = require("./routes/confirmacionesRoutes");
const lotesCierreRoutes = require("./routes/loteCierreRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/pagos-proveedores", (req, res) => {
  res.json({
    mensaje: "Microservicio de Pagos a Proveedores funcionando",
    estado: "activo"
  });
});

app.get("/health", async (req, res) => {
  try {
    await query("SELECT 1");
    res.json({ ok: true, db: "up" });
  } catch (e) {
    res.status(503).json({ ok: false, db: "down", mensaje: e.message });
  }
});

app.use("/api/egresos", egresosRoutes);
app.use("/api/proveedores", require("./routes/ordenPagoRoutes"));
app.use("/api/proveedores/notificaciones", require("./routes/notificacionRoutes"));
app.use("/ordenes-pago", confirmacionesRoutes);
app.use("/api/lotes-cierre", lotesCierreRoutes); // TDSI-21/418

app.use(errorHandler);

const PORT = process.env.PORT || 4006;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[PagosProveedores] Servidor corriendo en puerto ${PORT}`);
  require("./jobs/reintentoConfirmaciones").iniciar();
  require("./jobs/reintentoEnviosContabilidad").iniciar(); // TDSI-422
});