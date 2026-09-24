require("dotenv").config();
const express = require("express");
const facturacionRoutes = require("./routes/facturacionRoutes");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4002;

app.get("/facturacion", (req, res) => {
    res.json({ mensaje: "Microservicio de Facturación funcionando", estado: "activo" });
});

app.use("/api/facturas", facturacionRoutes);

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Facturación ejecutándose en el puerto ${PORT}`);
});