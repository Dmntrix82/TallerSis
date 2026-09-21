// Almacén en memoria compartido del microservicio de Gestión de Pagos.

// TDSI-272: historial de transacciones (ya existente, hecho por el equipo).
// Se reutiliza tal cual para TDSI-277, en vez de crear un array paralelo.
const historialTransacciones = [];

// TDSI-276: cabecera y detalle del pago mixto
const pagosMixtos = [];
const detallesPago = [];

const METODOS_VALIDOS = ['Efectivo', 'Tarjeta', 'QR'];

module.exports = { historialTransacciones, pagosMixtos, detallesPago, METODOS_VALIDOS };