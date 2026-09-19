const express = require('express');
const app = express();
const port = process.env.PORT || 4005;

app.use(express.json());

// Array temporal para simular el historial de transacciones (TDSI-272)
const historialTransacciones = [];

const METODOS_VALIDOS = ['Efectivo', 'Tarjeta', 'QR'];

app.post('/api/pagos/registrar', (req, res) => {
    const { id_transaccion, metodo, monto } = req.body;

    if (!id_transaccion || !metodo || monto === undefined) {
        return res.status(400).json({
            error: 'Datos incompletos',
            mensaje: 'Los campos id_transaccion, metodo y monto son obligatorios.'
        });
    }

    if (!METODOS_VALIDOS.includes(metodo)) {
        return res.status(400).json({
            error: 'Método de pago inválido',
            mensaje: `El método "${metodo}" no está permitido. Use: ${METODOS_VALIDOS.join(', ')}.`
        });
    }

    if (typeof monto !== 'number' || monto <= 0) {
        return res.status(400).json({
            error: 'Monto inválido',
            mensaje: 'El monto debe ser un número mayor a 0.'
        });
    }

    const nuevoPago = {
        id: historialTransacciones.length + 1,
        id_transaccion,
        metodo,
        monto,
        estado: 'Registrado',
        fecha: new Date().toISOString() // Fecha y hora del registro
    };

    historialTransacciones.push(nuevoPago);

    console.log('Pago registrado en historial:', nuevoPago);
    console.log('Historial actual:', historialTransacciones);

    res.status(200).json({
        mensaje: 'Pago registrado exitosamente',
        pago: nuevoPago,
        totalTransacciones: historialTransacciones.length
    });
});

// Endpoint extra para consultar el historial (útil para probar TDSI-272)
app.get('/api/pagos/historial', (req, res) => {
    res.status(200).json({
        total: historialTransacciones.length,
        historial: historialTransacciones
    });
});

app.listen(port, () => {
    console.log(`Microservicio de Pagos corriendo en el puerto ${port}`);
});