const { obtenerFactura, generarTirilla } = require("./tirillaService");

// TDSI-296: adaptador de impresora simulada
const impresora = {
  modelo: process.env.IMPRESORA_MODELO || "EPSON TM-T20III (simulada)",
  conectada: true,
  enviar(texto) {
    if (!this.conectada) {
      const e = new Error("Impresora no conectada");
      e.status = 503;
      throw e;
    }
    const jobId = "JOB-" + Date.now().toString(36).toUpperCase();
    console.log(`[IMPRESORA ${this.modelo}] job ${jobId}\n${texto}`);
    return { jobId, bytes: Buffer.byteLength(texto, "utf8"), enviadoEn: new Date().toISOString() };
  },
};

function estadoImpresora() {
  return { modelo: impresora.modelo, conectada: impresora.conectada };
}

function conmutarImpresora(conectada) {
  impresora.conectada = Boolean(conectada);
  return estadoImpresora();
}

/** TDSI-297: imprime y registra en el sistema que la factura ya fue impresa. */
function imprimir(numero) {
  const factura = obtenerFactura(numero);
  if (factura.impresa) {
    const e = new Error("La factura ya fue impresa. Use el endpoint de reimpresión.");
    e.status = 409;
    throw e;
  }
  const tirilla = generarTirilla(numero, { copia: false });
  const envio = impresora.enviar(tirilla.texto);

  factura.impresa = true;
  factura.vecesImpresa += 1;
  factura.impresaEn = envio.enviadoEn;

  return { numero, jobId: envio.jobId, impresoEn: envio.enviadoEn, tirilla: tirilla.texto };
}

module.exports = { impresora, estadoImpresora, conmutarImpresora, imprimir };