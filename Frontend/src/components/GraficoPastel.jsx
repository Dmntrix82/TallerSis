// Grafico de pastel/dona ("pizzita"): proporciones via stroke-dasharray sobre
// circulos concentricos, sin libreria. La identidad nunca depende solo del
// color: la leyenda siempre repite etiqueta + valor + porcentaje en texto.
function GraficoPastel({ items, formatoValor = (v) => v }) {
  const total = items.reduce((acc, i) => acc + i.valor, 0) || 1
  const radio = 52
  const grosor = 22
  const centro = 64
  const circunferencia = 2 * Math.PI * radio

  let acumulado = 0

  return (
    <div className="grafico-pastel">
      <svg viewBox="0 0 128 128" className="grafico-pastel-svg">
        <g transform={`rotate(-90 ${centro} ${centro})`}>
          {items.map((item) => {
            const fraccion = item.valor / total
            const largo = fraccion * circunferencia
            const offset = -acumulado
            acumulado += largo
            return (
              <circle
                key={item.etiqueta}
                cx={centro}
                cy={centro}
                r={radio}
                fill="none"
                stroke={item.color}
                strokeWidth={grosor}
                strokeDasharray={`${largo} ${circunferencia - largo}`}
                strokeDashoffset={offset}
              >
                <title>{item.etiqueta}: {formatoValor(item.valor)}</title>
              </circle>
            )
          })}
        </g>
      </svg>
      <ul className="grafico-pastel-leyenda">
        {items.map((item) => (
          <li key={item.etiqueta}>
            <span className="grafico-barra-dot" style={{ backgroundColor: item.color }} />
            {item.etiqueta}: {formatoValor(item.valor)} ({total > 0 ? Math.round((item.valor / total) * 100) : 0}%)
          </li>
        ))}
      </ul>
    </div>
  )
}

export default GraficoPastel
