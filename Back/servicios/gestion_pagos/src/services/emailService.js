const nodemailer = require("nodemailer");
const { lineaAtendidoPor } = require("../utils/atendidoPor");

// Extension de TDSI-107/108: aun no hay credenciales SMTP reales para este proyecto.
// Mientras SMTP_HOST/SMTP_USER/SMTP_PASS no esten en el .env, el correo se "simula"
// (se arma el HTML y se deja constancia en pagos.facturas_enviadas) en vez de mandarse
// de verdad. Apenas lleguen las credenciales, esto empieza a enviar sin tocar el resto.
// Solo para pruebas: reemplaza el transportador real (null fuerza "simulado"
// aunque haya credenciales SMTP reales en el .env; undefined vuelve al real).
let transportadorPrueba;

function transportadorConfigurado() {
  if (transportadorPrueba !== undefined) return transportadorPrueba;

  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

function usarTransportadorDePrueba(falso) {
  transportadorPrueba = falso;
}

// TDSI-51: una venta de Marketplace es un solo pago (no hay "metodos" que
// desglosar) y no tiene cajero/caja -- se muestra el detalle de items de la
// orden en vez del metodo de pago, y el numero de orden en vez de "atendido por".
function renderizarHtmlFactura(factura) {
  const esVentaOnline = Array.isArray(factura.items);

  const filasDetalle = esVentaOnline
    ? factura.items
        .map(
          (it) => `<tr><td style="padding:4px 0;">${it.descripcion} x${it.cantidad}</td><td style="padding:4px 0; text-align:right;">Bs. ${it.subtotal.toFixed(2)}</td></tr>`
        )
        .join("")
    : factura.pagos
        .map(
          (p) => `<tr><td style="padding:4px 0;">${p.metodo}</td><td style="padding:4px 0; text-align:right;">Bs. ${p.monto.toFixed(2)}</td></tr>`
        )
        .join("");

  const encabezadoDetalle = esVentaOnline
    ? '<th style="text-align:left; border-bottom:1px solid #e4e7eb; padding-bottom:4px;">Producto</th><th style="text-align:right; border-bottom:1px solid #e4e7eb; padding-bottom:4px;">Subtotal</th>'
    : '<th style="text-align:left; border-bottom:1px solid #e4e7eb; padding-bottom:4px;">Método de pago</th><th style="text-align:right; border-bottom:1px solid #e4e7eb; padding-bottom:4px;">Monto</th>';

  const lineaOrigen = esVentaOnline
    ? `Orden: ${factura.comprobante.orden_id}`
    : lineaAtendidoPor(factura.comprobante);

  return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color:#1f2933;">
      <h2 style="color:#345c32; margin-bottom:0;">${factura.empresa.nombre}</h2>
      <p style="color:#616e7c; margin-top:0.25rem;">${factura.empresa.direccion}</p>
      <hr style="border:none; border-top:1px solid #e4e7eb;" />
      <p>
        <strong>N° de transacción:</strong> ${factura.comprobante.id_transaccion}<br/>
        <strong>Fecha:</strong> ${new Date(factura.comprobante.fecha).toLocaleString("es-BO")}
      </p>
      <p><strong>Cliente:</strong> ${factura.cliente.razon_social}${factura.cliente.nit ? ` (NIT: ${factura.cliente.nit})` : ""}</p>
      <p style="color:#616e7c; font-size:0.9rem;">${lineaOrigen}</p>
      <table style="width:100%; border-collapse:collapse; margin-top:1rem;">
        <thead>
          <tr>${encabezadoDetalle}</tr>
        </thead>
        <tbody>${filasDetalle}</tbody>
      </table>
      <p style="text-align:right; font-size:1.2rem; font-weight:bold; margin-top:1rem;">
        Total: Bs. ${factura.total.toFixed(2)}
      </p>
      <hr style="border:none; border-top:1px solid #e4e7eb;" />
      <p style="color:#616e7c; font-size:0.85rem;">Gracias por su compra.</p>
    </div>
  `;
}

// TDSI-303: ademas del HTML del cuerpo, se adjunta la factura en PDF (misma
// estructura que se usa para imprimir en caja) cuando se provee pdfBuffer.
async function enviarFacturaPorCorreo({ email, factura, pdfBuffer }) {
  const html = renderizarHtmlFactura(factura);
  const transportador = transportadorConfigurado();

  if (!transportador) {
    console.log(`[email simulado] Factura de la transaccion ${factura.comprobante.id_transaccion} para ${email}`);
    return { estado: "SIMULADO", html };
  }

  try {
    await transportador.sendMail({
      from: process.env.SMTP_FROM || '"TallerSis" <no-responder@tallersis.local>',
      to: email,
      subject: `Tu factura - ${factura.comprobante.id_transaccion}`,
      html,
      attachments: pdfBuffer
        ? [{ filename: `factura-${factura.comprobante.id_transaccion}.pdf`, content: pdfBuffer, contentType: "application/pdf" }]
        : [],
    });
    return { estado: "ENVIADO", html };
  } catch (e) {
    console.error("Error enviando factura por correo:", e.message);
    return { estado: "ERROR", html, error: e.message };
  }
}

module.exports = { enviarFacturaPorCorreo, renderizarHtmlFactura, usarTransportadorDePrueba };
