// Grafico de barras horizontal simple (HTML/CSS, sin libreria). Cada fila muestra su
// propio color + etiqueta + valor, asi la identidad nunca depende solo del color.
function GraficoBarras({ items, formatoValor = (v) => v }) {
  const max = Math.max(...items.map((i) => i.valor), 1)

  return (
    <div className="grafico-barras">
      {items.map((item) => (
        <div key={item.etiqueta} className="grafico-barra-fila">
          <span className="grafico-barra-etiqueta">
            <span className="grafico-barra-dot" style={{ backgroundColor: item.color }} />
            {item.etiqueta}
          </span>
          <div className="grafico-barra-track">
            <div
              className="grafico-barra-fill"
              style={{ width: `${Math.max((item.valor / max) * 100, item.valor > 0 ? 2 : 0)}%`, backgroundColor: item.color }}
            />
          </div>
          <span className="grafico-barra-valor">{formatoValor(item.valor)}</span>
        </div>
      ))}
    </div>
  )
}

export default GraficoBarras
