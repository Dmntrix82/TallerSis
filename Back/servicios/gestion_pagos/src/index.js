const express = require('express');
const app = express();
const port = process.env.PORT || 4005;

app.use(express.json());

const { historialTransacciones } = require('./data/memoria');
const pagoMixtoRoutes = require('./routes/pagoMixtoRoutes');
const clientesRoutes = require('./routes/clientesRoutes');
const { guardarSiNoExiste } = require('./services/clientesService');
const { errorHandler } = require('./middlewares/errorHandler');

const METODOS_VALIDOS = ['Efectivo', 'Tarjeta', 'QR'];

app.post('/api/pagos/registrar', (req, res) => {
    const { id_transaccion, metodo, monto, nit, razon_social, email } = req.body;

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

    // TDSI-289: guardar cliente automáticamente si viene con NIT + razón social
    const clienteAutoguardado = guardarSiNoExiste({ nit, razon_social, email });

    const nuevoPago = {
        id: historialTransacciones.length + 1,
        id_transaccion,
        metodo,
        monto,
        nit: nit ?? null,
        razon_social: razon_social ?? null,
        estado: 'Registrado',
        fecha: new Date().toISOString()
    };

    historialTransacciones.push(nuevoPago);

    res.status(200).json({
        mensaje: 'Pago registrado exitosamente',
        pago: nuevoPago,
        totalTransacciones: historialTransacciones.length,
        clienteGuardado: clienteAutoguardado.creado,
        cliente: clienteAutoguardado.cliente,
    });
});

app.get('/api/pagos/historial', (req, res) => {
    res.status(200).json({
        total: historialTransacciones.length,
        historial: historialTransacciones
    });
});

app.use('/api/pagos', pagoMixtoRoutes);
app.use('/api/clientes', clientesRoutes);

app.use(errorHandler);

app.listen(port, () => {
    console.log(`Microservicio de Pagos corriendo en el puerto ${port}`);
});
