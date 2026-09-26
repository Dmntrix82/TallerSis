const { AppError } = require("../utils/AppError");
const repo = require("../data/ventasOnlineRepo");
const { aCentavos, aMonto } = require("../utils/money");

function generarCodigo() {
  return "CNF-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
}

async function recibirVenta(json) {
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    throw new AppError("El cuerpo de la peticion debe ser un objeto JSON", 400);
  }
  if (!json.ordenId) throw new AppError("El campo 'ordenId' es obligatorio", 400);

  if (await repo.existeOrden(json.ordenId)) {
    throw new AppError("La orden ya fue recibida anteriormente", 409, { ordenId: json.ordenId });
  }

  // TDSI-344: Validar ítems y totales matemáticos
  if (!Array.isArray(json.items) || json.items.length === 0) {
    throw new AppError("La venta debe tener al menos un ítem", 400);
  }

  const sumaC = json.items.reduce((acc, it) => acc + aCentavos(it.cantidad * it.precioUnitario), 0);
  if (sumaC !== aCentavos(json.total || 0)) {
    throw new AppError("El total no coincide con la suma de los ítems", 422, {
      totalRecibido: json.total, sumaItems: aMonto(sumaC),
    });
  }

  // TDSI-345 y TDSI-346: Generar confirmación, formatear y guardar en BD
  const codigoConfirmacion = generarCodigo();
  
  const itemsProcesados = json.items.map(it => ({
    sku: it.sku,
    descripcion: it.descripcion || it.sku,
    cantidad: Number(it.cantidad),
    precioUnitario: Number(it.precioUnitario),
    subtotal: aMonto(aCentavos(it.cantidad * it.precioUnitario))
  }));

  await repo.guardarVenta({
    ordenId: json.ordenId,
    clienteId: json.clienteId || null,
    total: json.total,
    metodoPago: json.metodoPago || "QR",
    codigoConfirmacion
  }, itemsProcesados);

  return { 
    recibido: true, 
    ordenId: json.ordenId, 
    codigoConfirmacion,
    estado: "RECIBIDO"
  };
}

module.exports = { recibirVenta };