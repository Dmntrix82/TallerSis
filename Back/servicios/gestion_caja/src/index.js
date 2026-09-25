require("dotenv").config();

const express = require("express");
const { query } = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const { errorHandler } = require("./middlewares/errorHandler");

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 4004;

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

app.use(errorHandler);

// Iniciar servidor
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Gestion de Caja ejecutandose en el puerto ${PORT}`);
});