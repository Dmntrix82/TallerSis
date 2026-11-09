/**
 * TDSI-61/944: linea "Atendido por" que se muestra igual en el PDF y en el correo
 * (logica pura, sin BD, para poder probarla sin generar un PDF ni mandar un correo).
 */
function lineaAtendidoPor(comprobante) {
  return comprobante.caja_id
    ? `Atendido por: ${comprobante.cajero_nombre} · Caja N° ${comprobante.caja_id}`
    : `Atendido por: ${comprobante.cajero_nombre}`;
}

module.exports = { lineaAtendidoPor };
