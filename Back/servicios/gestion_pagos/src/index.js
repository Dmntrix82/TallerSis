const express = require('express');
const app = express();
const port = process.env.PORT || 4005;

app.use(express.json()); 

// Endpoint para registrar el método de pago
app.post('/api/pagos/registrar', (req, res) => {
    const { id_transaccion, metodo, monto } = req.body; // Ahora req.body ya no será undefined

    console.log('Pago recibido:', { id_transaccion, metodo, monto });

    res.status(200).json({
        mensaje: 'Pago registrado exitosamente',
        pago: {
            id: 1,
            id_transaccion,
            metodo,
            monto,
            estado: 'Registrado'
        }
    });
});

app.listen(port, () => {
    console.log(`Microservicio de Pagos corriendo en el puerto ${port}`);
});