const facturasRepo = require("../data/facturasRepo");
const clientesService = require("./clientesService");

function err(mensaje, status = 400, detalle = null) {
  const e = new Error(mensaje);
  e.status = status;
  e.detalle = detalle;
  return e;
}

function validarItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw err("La factura debe tener al menos un item.");
  }
  for (const item of items) {
    if (
      !item.descripcion ||
      typeof item.cantidad !== "number" || item.cantidad <= 0 ||
      typeof item.precio_unitario !== "number" || item.precio_unitario < 0
    ) {
      throw err("Cada item debe tener descripcion, cantidad > 0 y precio_unitario >= 0.");
    }
  }
}

/** TDSI-89/279/280/281/282: ingresa el NIT y Razon Social del cliente al emitir la factura */
async function crearFactura({ nit, razon_social, items } = {}) {
  validarItems(items);

  // TDSI-280/282: guardarCliente valida el formato del NIT antes de guardar la factura
  const cliente = await clientesService.guardarCliente({ nit, razon_social });

  const itemsConSubtotal = items.map((i) => ({ ...i, subtotal: i.cantidad * i.precio_unitario }));
  const subtotal = itemsConSubtotal.reduce((acc, i) => acc + i.subtotal, 0);

  const factura = await facturasRepo.crearFactura({
    cliente_nit: cliente.nit,
    cliente_nombre: cliente.razon_social,
    items: itemsConSubtotal,
    subtotal,
    descuento: 0,
    impuesto: 0,
    total: subtotal,
  });

  return factura;
}

module.exports = { crearFactura };
