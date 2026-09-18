require("dotenv").config();

const express = require("express");

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 4004;

// Ruta de prueba
app.get("/cajeros", (req, res) => {
    res.json({
        mensaje: "Microservicio de Cajeros funcionando",
        estado: "activo"
    });
});

// Iniciar servidor
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Cajeros ejecutándose en el puerto ${PORT}`);
});