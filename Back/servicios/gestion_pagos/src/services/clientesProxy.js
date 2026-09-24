// Puente hacia el microservicio de facturacion, que es el dueno real de los
// datos de cliente (NIT / Razon Social). gestion_pagos NUNCA escribe esa
// tabla directamente -- ver la nota en sql/script_pagos.sql.
const FACTURACION_URL = process.env.FACTURACION_URL || "http://localhost:4002";

async function guardarClienteEnFacturacion({ nit, razon_social, email }) {
  if (!nit || !razon_social) return { creado: false, cliente: null };
  try {
    const r = await fetch(`${FACTURACION_URL}/api/clientes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nit, razon_social, email }),
    });
    const data = await r.json().catch(() => null);
    return { creado: r.status === 201, cliente: data && data.data ? data.data : null };
  } catch (e) {
    // Si facturacion esta caida, el pago igual se registra -- no bloqueamos el cobro por esto.
    console.error("No se pudo sincronizar cliente con facturacion:", e.message);
    return { creado: false, cliente: null };
  }
}

module.exports = { guardarClienteEnFacturacion };