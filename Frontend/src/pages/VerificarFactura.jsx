import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { verificarFactura } from '../api/facturaPublica.js'

// TDSI-38/551-554: pagina publica (sin login) a la que lleva el QR impreso en
// la factura. De solo lectura, pensada para abrirse desde el celular del cliente.
function VerificarFactura() {
  const { token } = useParams()
  const [factura, setFactura] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setCargando(true)
    verificarFactura(token)
      .then((r) => {
        setFactura(r.data)
        setError(null)
      })
      .catch((err) => {
        setFactura(null)
        setError(err.message)
      })
      .finally(() => setCargando(false))
  }, [token])

  return (
    <div className="verificar-factura-pagina">
      <div className="verificar-factura-tarjeta">
        <div className="verificar-factura-marca">TallerSis</div>

        {cargando && <p>Cargando...</p>}

        {/* TDSI-554 */}
        {!cargando && error && (
          <div className="verificar-factura-error">
            <h1>Factura no encontrada</h1>
            <p>Este código QR no corresponde a ninguna factura válida, o ya no está disponible.</p>
          </div>
        )}

        {!cargando && factura && (
          <>
            {factura.estado === 'Anulado' && <div className="verificar-factura-anulada">ANULADA</div>}

            <h1>Comprobante de pago</h1>
            <p className="verificar-factura-numero">{factura.id_transaccion}</p>

            <dl className="verificar-factura-datos">
              <dt>Fecha</dt>
              <dd>{new Date(factura.fecha).toLocaleString()}</dd>

              <dt>Cliente</dt>
              <dd>
                {factura.cliente}
                {factura.nit ? ` (NIT/CI: ${factura.nit})` : ''}
              </dd>
            </dl>

            <table className="verificar-factura-tabla">
              <thead>
                <tr>
                  <th>Método de pago</th>
                  <th>Monto</th>
                </tr>
              </thead>
              <tbody>
                {factura.metodos.map((m) => (
                  <tr key={m.metodo}>
                    <td>{m.metodo}</td>
                    <td>Bs. {m.monto.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td>Bs. {factura.total.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>

            <p className="verificar-factura-pie">Documento generado por el sistema TallerSis. Uso académico.</p>
          </>
        )}
      </div>
    </div>
  )
}

export default VerificarFactura
