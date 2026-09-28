const nodemailer = require("nodemailer");

// Extension de TDSI-107/108: aun no hay credenciales SMTP reales para este proyecto.
// Mientras SMTP_HOST/SMTP_USER/SMTP_PASS no esten en el .env, el correo se "simula"
// (se arma el HTML y se deja constancia en pagos.facturas_enviadas) en vez de mandarse
// de verdad. Apenas lleguen las credenciales, esto empieza a enviar sin tocar el resto.
function transportadorConfigurado() {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

function renderizarHtmlFactura(factura) {
  const filasPago = factura.pagos
    .map(
      (p) => `<tr><td style="padding:4px 0;">${p.metodo}</td><td style="padding:4px 0; text-align:right;">Bs. ${p.monto.toFixed(2)}</td></tr>`
    )
    .join("");

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
      <table style="width:100%; border-collapse:collapse; margin-top:1rem;">
        <thead>
          <tr>
            <th style="text-align:left; border-bottom:1px solid #e4e7eb; padding-bottom:4px;">Método de pago</th>
            <th style="text-align:right; border-bottom:1px solid #e4e7eb; padding-bottom:4px;">Monto</th>
          </tr>
        </thead>
        <tbody>${filasPago}</tbody>
      </table>
      <p style="text-align:right; font-size:1.2rem; font-weight:bold; margin-top:1rem;">
        Total: Bs. ${factura.total.toFixed(2)}
      </p>
      <hr style="border:none; border-top:1px solid #e4e7eb;" />
      <p style="color:#616e7c; font-size:0.85rem;">Gracias por su compra.</p>
    </div>
  `;
}

async function enviarFacturaPorCorreo({ email, factura }) {
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
    });
    return { estado: "ENVIADO", html };
  } catch (e) {
    console.error("Error enviando factura por correo:", e.message);
    return { estado: "ERROR", html, error: e.message };
  }
}

module.exports = { enviarFacturaPorCorreo, renderizarHtmlFactura };
