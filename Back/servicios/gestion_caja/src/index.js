require("dotenv").config();

const express = require("express");
const { query } = require("./config/db");
const { errorHandler } = require("./middlewares/errorHandler");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4004;

// Ruta de prueba + verificación de la BD
app.get("/cajeros", async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT to_regclass('caja.turnos') AS tabla_turnos`);
    res.json({
      mensaje: "Microservicio de Cajeros funcionando",
      estado: "activo",
      bd: rows[0].tabla_turnos ? "conectada" : "conectada, pero falta ejecutar script_caja.sql",
    });
  } catch (e) {
    next(e);
  }
});

// Aquí se montarán las rutas (TDSI-311):
// app.use("/turnos", require("./routes/turnosRoutes"));

// Ruta no encontrada
app.use((req, res) => res.status(404).json({ ok: false, mensaje: "Ruta no encontrada" }));

// Manejador global de errores (siempre al final)
app.use(errorHandler);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Cajeros ejecutándose en el puerto ${PORT}`);
});