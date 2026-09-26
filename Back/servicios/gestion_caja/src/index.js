require("dotenv").config();
const express = require("express");
const { query } = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const turnosRoutes = require("./routes/turnosRoutes");
const { errorHandler } = require("./middlewares/errorHandler");
const { cerrarSesionesInactivas } = require("./services/sesionCajeroService");

const app = express();
const PORT = process.env.PORT || 4004;

app.use(express.json());

// Ruta de prueba
app.get("/gestion-caja", (req, res) => {
    res.json({
        mensaje: "Microservicio de Gestion de Caja funcionando",
        estado: "activo"
    });
});

// Verifica que el microservicio SI puede conectarse a la base de datos de Supabase
app.get("/health", async (req, res) => {
    try {
        await query("SELECT 1");
        res.json({ ok: true, db: "up" });
    } catch (e) {
        res.status(503).json({ ok: false, db: "down", mensaje: e.message });
    }
});

app.use("/api/auth", authRoutes);
app.use("/api/caja", turnosRoutes);

app.use(errorHandler);

// TDSI-268: cada minuto revisa y cierra las sesiones inactivas
setInterval(async () => {
    try {
        const cerradas = await cerrarSesionesInactivas();
        if (cerradas.length > 0) {
            console.log(`Cierre automatico: ${cerradas.length} sesion(es) cerrada(s) por inactividad.`);
        }
    } catch (e) {
        console.error("Error cerrando sesiones inactivas:", e.message);
    }
}, 60 * 1000);

// Iniciar servidor
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Gestion de Caja ejecutandose en el puerto ${PORT}`);
});
