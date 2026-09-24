// Almacén en memoria compartido del microservicio de Gestión de Pagos.

// TDSI-272: historial de transacciones
const historialTransacciones = [];

// TDSI-276: cabecera y detalle del pago mixto
const pagosMixtos = [];
const detallesPago = [];

const METODOS_VALIDOS = ['Efectivo', 'Tarjeta', 'QR'];

// TDSI-287: tabla en memoria de clientes frecuentes
const clientesFrecuentes = [
  { nit: '123456789', razon_social: 'Juan Pérez',         email: 'juan@example.com' },
  { nit: '987654321', razon_social: 'María López',        email: 'maria@example.com' },
  { nit: '555555555', razon_social: 'Supermercado El Sol', email: 'contacto@elsol.com' },
];

module.exports = {
  historialTransacciones,
  pagosMixtos,
  detallesPago,
  METODOS_VALIDOS,
  clientesFrecuentes,
};
