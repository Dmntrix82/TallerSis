// TDSI-829/830: aviso de que esta venta parece repetir un cobro reciente al mismo cliente.
// TDSI-831: compara el cobro anterior con la venta actual. Las ventas todavia no guardan
// items (el proyecto no tiene catalogo de productos), asi que se compara lo que si registran.
function AvisoCobroDuplicadoModal({ factura, segundos, anterior, actual, onCancelar, onCobrarIgual }) {
  const totalAnterior = anterior?.total ?? actual.total
  const tiempo = segundos === 1 ? '1 segundo' : `${segundos} segundos`

  return (
    <div className="modal-overlay">
      <div className="modal-caja modal-duplicado" role="alertdialog" aria-modal="true" aria-labelledby="titulo-aviso-duplicado">
        <h2 id="titulo-aviso-duplicado">Posible cobro repetido</h2>
        <p>
          Ya cobraste Bs {totalAnterior.toFixed(2)} a este cliente hace {tiempo} (Factura N° {factura}). ¿Seguro que
          quieres cobrar de nuevo?
        </p>

        {anterior ? (
          <table className="comparacion-cobro">
            <thead>
              <tr>
                <th></th>
                <th>Cobro anterior</th>
                <th>Esta venta</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>Total</th>
                <td>Bs {anterior.total.toFixed(2)}</td>
                <td>Bs {actual.total.toFixed(2)}</td>
              </tr>
              <tr>
                <th>Método</th>
                <td>{anterior.metodos.join(' + ')}</td>
                <td>{actual.metodos.join(' + ')}</td>
              </tr>
              <tr>
                <th>Cliente</th>
                <td>{anterior.razon_social || '-'}</td>
                <td>{actual.razonSocial || '-'}</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <p className="ayuda-mixto">No se pudo cargar el detalle del cobro anterior.</p>
        )}

        <button type="button" className="btn btn-secundario" onClick={onCancelar} autoFocus>
          Cancelar
        </button>
        <button type="button" className="btn btn-peligro" onClick={onCobrarIgual}>
          Cobrar igual
        </button>
      </div>
    </div>
  )
}

export default AvisoCobroDuplicadoModal
