const db = { facturas: [] };

function seed() {
  db.facturas.length = 0;
  db.facturas.push({
    numero: "F-000001",
    ventaId: "V-1",
    fecha: "2026-09-20T10:15:00.000Z",
    cliente: { nombre: "Juan Perez", nit: "1234567" },
    sucursal: { nombre: "Sucursal Central", direccion: "Av. Arce #123", telefono: "2-2445566" },
    items: [
      { descripcion: "Arroz 1kg", cantidad: 2, precioUnitario: 10, subtotal: 20 },
      { descripcion: "Aceite 900ml", cantidad: 1, precioUnitario: 15, subtotal: 15 },
    ],
    subtotal: 35,
    descuento: 0,
    impuesto: 4.55,
    total: 35,
    metodosPago: [{ metodo: "Efectivo", monto: 20 }, { metodo: "QR", monto: 15 }],
    impresa: false,
    vecesImpresa: 0,
  });
}
seed();

module.exports = { db, seed };