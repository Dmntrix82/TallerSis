const texto = (valor) => (valor === null || valor === undefined || String(valor).trim() === '' ? '—' : valor)


export default function ComparacionModificacion({ actual, nuevo }) {
  const filas = [
    ['Tipo de documento', actual.tipoDocumento, nuevo.tipoDocumento],
    ['NIT/CI', actual.numeroDocumento, nuevo.numeroDocumento],
    ['Razón social', actual.razonSocial, nuevo.razonSocial],
    ['Teléfono', actual.telefono, nuevo.telefono],
  ]
  const normalizar = (v) => String(v ?? '').trim()

  return (
    <div className="comparacion-modificacion">
      <h3>Cambios solicitados</h3>
      <table>
        <thead>
          <tr>
            <th>Dato</th>
            <th>Actual</th>
            <th>Nuevo</th>
          </tr>
        </thead>
        <tbody>
          {filas.map(([etiqueta, valorActual, valorNuevo]) => {
            const cambio = normalizar(valorActual) !== normalizar(valorNuevo)
            return (
              <tr key={etiqueta} className={cambio ? 'comparacion-cambio' : undefined}>
                <th scope="row">{etiqueta}</th>
                <td>{texto(valorActual)}</td>
                <td>
                  {texto(valorNuevo)}
                  {cambio && <span className="comparacion-etiqueta">Modificado</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
