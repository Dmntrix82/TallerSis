// TDSI-296: adaptador de impresora. Sin hardware real, se simula el envío del trabajo de impresión.
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

module.exports = { impresora, estadoImpresora, conmutarImpresora };