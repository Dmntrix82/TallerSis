import {
  DENOMINACIONES,
  compararConEsperado,
  esCantidadValida,
  etiquetaDenominacion,
  formatearBs,
  subtotalCentavos,
  totalContadoCentavos,
} from '../utils/arqueo.js'

const GRUPOS = [
  { tipo: 'billete', titulo: 'Billetes' },
  { tipo: 'moneda', titulo: 'Monedas' },
]

// TDSI-60: tabla "Arqueo de efectivo" para la pantalla "Cierre de Caja".
// El estado vive en el padre: const [cantidades, setCantidades] = useState({})
export default function ArqueoEfectivo({ cantidades, onChange, efectivoEsperado, mostrarDiferencia = true }) {
  const total = totalContadoCentavos(cantidades)
  const comparacion = compararConEsperado(total, efectivoEsperado)

  const cambiar = (centavos, valor) => onChange({ ...cantidades, [centavos]: valor })

  return (
    <section className="arqueo" aria-labelledby="arqueo-titulo">
      <h3 id="arqueo-titulo">Arqueo de efectivo</h3>
      <p className="arqueo-ayuda">Escribe cuántos billetes y monedas tienes de cada valor.</p>

      {/* TDSI-198: billetes y monedas de Bs */}
      <div className="arqueo-tabla-contenedor">
        <table className="arqueo-tabla">
          <thead>
            <tr>
              <th>Denominación</th>
              <th>Cantidad</th>
              <th className="arqueo-derecha">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {GRUPOS.map((grupo) => (
              <GrupoFilas key={grupo.tipo} grupo={grupo} cantidades={cantidades} cambiar={cambiar} />
            ))}
          </tbody>
          {/* TDSI-881: total contado en vivo */}
          <tfoot>
            <tr>
              <th colSpan={2}>Total contado</th>
              <td className="arqueo-derecha arqueo-total">{formatearBs(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* TDSI-882: diferencia con el efectivo esperado, antes de confirmar */}
      {mostrarDiferencia && (
        <div className={`arqueo-resultado arqueo-${comparacion.estado}`} role="status" aria-live="polite">
          <div>
            <span>Efectivo esperado</span>
            <strong>{comparacion.esperadoCentavos === null ? '—' : formatearBs(comparacion.esperadoCentavos)}</strong>
          </div>
          <div>
            <span>Resultado</span>
            <strong>{comparacion.etiqueta}</strong>
          </div>
        </div>
      )}
    </section>
  )
}

function GrupoFilas({ grupo, cantidades, cambiar }) {
  return (
    <>
      <tr className="arqueo-grupo">
        <th colSpan={3} scope="colgroup">{grupo.titulo}</th>
      </tr>
      {DENOMINACIONES.filter((d) => d.tipo === grupo.tipo).map((d) => {
        const valor = cantidades?.[d.centavos] ?? ''
        const valido = esCantidadValida(valor)
        const idError = `arqueo-error-${d.centavos}`
        return (
          <tr key={d.centavos}>
            <th scope="row">{etiquetaDenominacion(d.centavos)}</th>
            <td>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="0"
                value={valor}
                onChange={(event) => cambiar(d.centavos, event.target.value)}
                aria-label={`Cantidad de ${grupo.tipo === 'billete' ? 'billetes' : 'monedas'} de ${etiquetaDenominacion(d.centavos)}`}
                aria-invalid={!valido}
                aria-describedby={valido ? undefined : idError}
                className={valido ? undefined : 'arqueo-input-invalido'}
              />
              {/* TDSI-883: solo números enteros */}
              {!valido && <small id={idError} className="arqueo-error">Solo números enteros</small>}
            </td>
            <td className="arqueo-derecha">{valido ? formatearBs(subtotalCentavos(cantidades, d.centavos)) : '—'}</td>
          </tr>
        )
      })}
    </>
  )
}

// TDSI-884: detalle del arqueo para el resumen final del cierre
export function ResumenArqueo({ cantidades, efectivoEsperado }) {
  const total = totalContadoCentavos(cantidades)
  const comparacion = compararConEsperado(total, efectivoEsperado)
  const filas = DENOMINACIONES.filter((d) => subtotalCentavos(cantidades, d.centavos) > 0)

  return (
    <section className="arqueo arqueo-resumen" aria-labelledby="arqueo-resumen-titulo">
      <h3 id="arqueo-resumen-titulo">Detalle del arqueo de efectivo</h3>
      {filas.length === 0 ? (
        <p className="arqueo-ayuda">No se registró efectivo contado.</p>
      ) : (
        <div className="arqueo-tabla-contenedor">
          <table className="arqueo-tabla">
            <thead>
              <tr>
                <th>Denominación</th>
                <th className="arqueo-derecha">Cantidad</th>
                <th className="arqueo-derecha">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((d) => (
                <tr key={d.centavos}>
                  <th scope="row">{etiquetaDenominacion(d.centavos)} <small>({d.tipo === 'billete' ? 'billete' : 'moneda'})</small></th>
                  <td className="arqueo-derecha">{Number(String(cantidades[d.centavos]).trim())}</td>
                  <td className="arqueo-derecha">{formatearBs(subtotalCentavos(cantidades, d.centavos))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={2}>Total contado</th>
                <td className="arqueo-derecha arqueo-total">{formatearBs(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <div className={`arqueo-resultado arqueo-${comparacion.estado}`}>
        <div>
          <span>Efectivo esperado</span>
          <strong>{comparacion.esperadoCentavos === null ? '—' : formatearBs(comparacion.esperadoCentavos)}</strong>
        </div>
        <div>
          <span>Resultado</span>
          <strong>{comparacion.etiqueta}</strong>
        </div>
      </div>
    </section>
  )
}
