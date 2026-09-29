// Grafico de area ("montañitas"): serie de valores en el tiempo, sin libreria,
// via SVG puro (polyline + poligono de relleno). Los dias en 0 se ven como valle.
function GraficoArea({ items, color = '#345c32', formatoValor = (v) => v }) {
  const w = 600
  const h = 220
  const padding = 20
  const max = Math.max(...items.map((i) => i.valor), 1)
  const stepX = items.length > 1 ? (w - padding * 2) / (items.length - 1) : 0

  const puntos = items.map((item, i) => ({
    x: padding + i * stepX,
    y: h - padding - (item.valor / max) * (h - padding * 2),
    ...item,
  }))

  const linea = puntos.map((p) => `${p.x},${p.y}`).join(' ')
  const area = `${padding},${h - padding} ${linea} ${w - padding},${h - padding}`

  return (
    <div className="grafico-area">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="grafico-area-svg">
        <polygon points={area} fill={color} fillOpacity="0.15" />
        <polyline points={linea} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {puntos.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3.5" fill={color}>
            <title>{p.etiqueta}: {formatoValor(p.valor)}</title>
          </circle>
        ))}
      </svg>
      <div className="grafico-area-ejes">
        {items.map((item, i) => (
          <span key={i} className="grafico-area-etiqueta">{item.etiqueta}</span>
        ))}
      </div>
    </div>
  )
}

export default GraficoArea
