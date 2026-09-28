require("dotenv").config();
const express = require("express");
const app = express();

app.use(express.json());

// Conexión de rutas
app.use("/api/proveedores", require("./routes/ordenPagoRoutes"));
app.use("/api/proveedores/notificaciones", require("./routes/notificacionRoutes"));

// Manejo de errores genérico
app.use((err, req, res, next) => {
  const status = err.status || 500;
  res.status(status).json({ ok: false, error: err.message || "Error interno del servidor" });
});

const PORT = process.env.PORT || 4006;
app.listen(PORT, () => {
  console.log(`[PagosProveedores] Servidor corriendo en puerto ${PORT}`);
});