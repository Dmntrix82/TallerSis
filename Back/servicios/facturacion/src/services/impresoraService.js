const { obtenerFactura, generarTirilla } = require("./tirillaService");
const facturasRepo = require("../data/facturasRepo");

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

/** TDSI-306: no se puede modificar una factura mientras esta en revision */
function rechazarSiBloqueada(factura) {
  if (factura.bloqueada) {
    const e = new Error("La factura esta bloqueada por una anulacion en revision.");
    e.status = 409;
    throw e;
  }
}

async function imprimir(numero) {
  const factura = await obtenerFactura(numero);
  rechazarSiBloqueada(factura);
  if (factura.impresa) {
    const e = new Error("La factura ya fue impresa. Use el endpoint de reimpresion.");
    e.status = 409;
    throw e;
  }
  const tirilla = await generarTirilla(numero, { copia: false });
  const envio = impresora.enviar(tirilla.texto);

  await facturasRepo.marcarImpresa(numero, envio.enviadoEn);
  await facturasRepo.registrarImpresion({ facturaNumero: numero, tipo: "ORIGINAL", jobId: envio.jobId });

  return { numero, jobId: envio.jobId, impresoEn: envio.enviadoEn, tirilla: tirilla.texto };
}

async function reimprimir(numero, motivo) {
  const factura = await obtenerFactura(numero);
  rechazarSiBloqueada(factura);
  if (!factura.impresa) {
    const e = new Error("La factura aun no fue impresa. Use /imprimir primero.");
    e.status = 409;
    throw e;
  }

  const tirilla = await generarTirilla(numero, { copia: true });
  const envio = impresora.enviar(tirilla.texto);

  const vecesImpresa = await facturasRepo.incrementarVecesImpresa(numero);
  await facturasRepo.registrarImpresion({
    facturaNumero: numero, tipo: "COPIA", motivo: motivo || "No especificado", jobId: envio.jobId,
  });

  return {
    numero,
    tipo: "COPIA",
    motivo: motivo || "No especificado",
    jobId: envio.jobId,
    reimpresoEn: envio.enviadoEn,
    copiaNro: vecesImpresa - 1,
    tirilla: tirilla.texto,
  };
}

module.exports = { impresora, estadoImpresora, conmutarImpresora, imprimir, reimprimir };