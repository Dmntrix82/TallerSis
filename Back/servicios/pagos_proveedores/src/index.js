require("dotenv").config();

const express = require("express");
const { query } = require("./config/db");
const { errorHandler } = require("./middlewares/errorHandler");
const egresosRoutes = require("./routes/egresosRoutes");
const confirmacionesRoutes = require("./routes/confirmacionesRoutes");

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 4006;

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
app.use("/ordenes-pago", confirmacionesRoutes);

app.use(errorHandler);

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Pagos a Proveedores ejecutandose en el puerto ${PORT}`);
    require("./jobs/reintentoConfirmaciones").iniciar();
});