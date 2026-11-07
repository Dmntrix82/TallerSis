// TDSI-60: denominaciones bolivianas en centavos (evita errores de decimales: 0.10 + 0.20 ...)
export const DENOMINACIONES = [
  { centavos: 20000, tipo: 'billete' },
  { centavos: 10000, tipo: 'billete' },
  { centavos: 5000, tipo: 'billete' },
  { centavos: 2000, tipo: 'billete' },
  { centavos: 1000, tipo: 'billete' },
  { centavos: 500, tipo: 'moneda' },
  { centavos: 200, tipo: 'moneda' },
  { centavos: 100, tipo: 'moneda' },
  { centavos: 50, tipo: 'moneda' },
  { centavos: 20, tipo: 'moneda' },
  { centavos: 10, tipo: 'moneda' },
]

// 20000 -> "Bs 200" · 50 -> "Bs 0.50"
export const etiquetaDenominacion = (centavos) =>
  centavos % 100 === 0 ? `Bs ${centavos / 100}` : `Bs ${(centavos / 100).toFixed(2)}`

// 40000 -> "Bs 400.00"
export const formatearBs = (centavos) => `Bs ${(centavos / 100).toFixed(2)}`

// TDSI-883: solo enteros no negativos. Vacío cuenta como 0.
export const esCantidadValida = (valor) => valor === undefined || valor === null || valor === '' || /^\d+$/.test(String(valor).trim())

export const arqueoEsValido = (cantidades) => DENOMINACIONES.every((d) => esCantidadValida(cantidades?.[d.centavos]))

// ¿Se escribió al menos una cantidad? (permite un arqueo de solo ceros, pero no uno en blanco)
export const arqueoTieneConteo = (cantidades) =>
  DENOMINACIONES.some((d) => String(cantidades?.[d.centavos] ?? '').trim() !== '')

const cantidadNumerica = (valor) => (esCantidadValida(valor) && valor !== '' && valor != null ? Number(String(valor).trim()) : 0)

// TDSI-881: total contado en centavos (las celdas inválidas no suman)
export const totalContadoCentavos = (cantidades) =>
  DENOMINACIONES.reduce((suma, d) => suma + cantidadNumerica(cantidades?.[d.centavos]) * d.centavos, 0)

export const subtotalCentavos = (cantidades, centavos) => cantidadNumerica(cantidades?.[centavos]) * centavos

// TDSI-882: compara lo contado con el efectivo esperado (en Bs, como viene del sistema)
export const compararConEsperado = (contadoCentavos, efectivoEsperado) => {
  const esperado = Number(efectivoEsperado)
  if (efectivoEsperado === null || efectivoEsperado === undefined || efectivoEsperado === '' || Number.isNaN(esperado)) {
    return { estado: 'sin-dato', esperadoCentavos: null, diferenciaCentavos: 0, etiqueta: 'Efectivo esperado no disponible' }
  }
  const esperadoCentavos = Math.round(esperado * 100)
  const diferenciaCentavos = contadoCentavos - esperadoCentavos
  if (diferenciaCentavos === 0) {
    return { estado: 'cuadra', esperadoCentavos, diferenciaCentavos: 0, etiqueta: 'Cuadra' }
  }
  if (diferenciaCentavos < 0) {
    return { estado: 'faltante', esperadoCentavos, diferenciaCentavos, etiqueta: `Faltante: ${formatearBs(-diferenciaCentavos)}` }
  }
  return { estado: 'sobrante', esperadoCentavos, diferenciaCentavos, etiqueta: `Sobrante: ${formatearBs(diferenciaCentavos)}` }
}

// Detalle listo para enviar al backend: [{ denominacion: 100, cantidad: 3, subtotal: 300 }, ...]
export const detalleArqueo = (cantidades) =>
  DENOMINACIONES.map((d) => {
    const cantidad = cantidadNumerica(cantidades?.[d.centavos])
    return { tipo: d.tipo, denominacion: d.centavos / 100, cantidad, subtotal: (cantidad * d.centavos) / 100 }
  }).filter((fila) => fila.cantidad > 0)
