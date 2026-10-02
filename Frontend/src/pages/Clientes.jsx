import { useState } from 'react'
import { historialCliente, urlFacturaPdf } from '../api/pagos.js'

const TIPOS_DOCUMENTO = [
  { id: 'NIT', etiqueta: 'NIT' },
  { id: 'CI', etiqueta: 'CI' },
]

// TDSI-327: el administrador busca cualquier cliente por NIT o CI y ve cuantas
// veces vino y que ha facturado cada vez.
function Clientes() {
  const [tipoDocumento, setTipoDocumento] = useState('NIT')
  const [numero, setNumero] = useState('')
  const [cliente, setCliente] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [buscado, setBuscado] = useState(false)

  async function buscar(event) {
    event.preventDefault()
    if (!numero.trim()) {
      setError('Ingrese el número de NIT o CI a buscar.')
      return
    }

    setCargando(true)
    setError(null)
    setBuscado(true)
    try {
      const respuesta = await historialCliente(tipoDocumento, numero.trim())
      setCliente(respuesta.data)
    } catch (err) {
      setCliente(null)
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <section>
      <h1>Buscar cliente</h1>
      <p>Busque un cliente por NIT o CI para ver cuántas veces vino y lo que ha facturado.</p>

      <form onSubmit={buscar} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div className="tipo-venta-opciones">
          {TIPOS_DOCUMENTO.map((tipo) => (
            <button
              key={tipo.id}
              type="button"
              className={`tipo-venta-opcion${tipoDocumento === tipo.id ? ' activa' : ''}`}
              onClick={() => setTipoDocumento(tipo.id)}
            >
              {tipo.etiqueta}
            </button>
          ))}
        </div>

        <label className="campo" style={{ marginBottom: 0 }}>
          Número de {tipoDocumento}
          <input
            type="text"
            inputMode="numeric"
            maxLength={tipoDocumento === 'NIT' ? 10 : 8}
            value={numero}
            onChange={(e) => setNumero(e.target.value.replace(/\D/g, ''))}
          />
        </label>

        <button type="submit" className="btn" disabled={cargando}>
          {cargando ? 'Buscando...' : 'Buscar'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {buscado && !cargando && !error && cliente && (
        <div className="cliente-resumen">
          <h2>{cliente.razon_social || 'Cliente'}</h2>
          <p style={{ color: '#616e7c', marginTop: '-0.5rem' }}>
            {cliente.tipo_documento}: {cliente.numero}
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', margin: '1rem 0' }}>
            <div style={{ padding: '1rem', backgroundColor: '#ecfdf5', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#065f46' }}>Veces que vino</p>
              <p style={{ margin: 0, fontSize: '1.3rem', fontWeight: 'bold', color: '#065f46' }}>{cliente.cantidadCompras}</p>
            </div>
            <div style={{ padding: '1rem', backgroundColor: '#eef2ff', borderRadius: '8px', border: '1px solid #c7d2fe' }}>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#3730a3' }}>Total gastado</p>
              <p style={{ margin: 0, fontSize: '1.3rem', fontWeight: 'bold', color: '#3730a3' }}>Bs. {cliente.totalGastado.toFixed(2)}</p>
            </div>
            {cliente.cantidadAnuladas > 0 && (
              <div style={{ padding: '1rem', backgroundColor: '#fef2f2', borderRadius: '8px', border: '1px solid #fecdd3' }}>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#b91c1c' }}>Facturas anuladas</p>
                <p style={{ margin: 0, fontSize: '1.3rem', fontWeight: 'bold', color: '#b91c1c' }}>{cliente.cantidadAnuladas}</p>
              </div>
            )}
          </div>

          <table className="tabla-facturas">
            <thead>
              <tr>
                <th>Número</th>
                <th>Fecha</th>
                <th>Método(s)</th>
                <th>Total (Bs.)</th>
                <th>Cajero</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cliente.facturas.map((f) => (
                <tr key={f.id_transaccion}>
                  <td>{f.id_transaccion}</td>
                  <td>{new Date(f.fecha).toLocaleString()}</td>
                  <td>{f.metodos.join(' + ')}</td>
                  <td>{f.total.toFixed(2)}</td>
                  <td>{f.cajero || '-'}</td>
                  <td>
                    <span className={`badge-estado ${f.estado === 'Registrado' ? 'badge-estado--emitida' : ''}`}>
                      {f.estado === 'Registrado' ? 'Emitida' : 'Anulada'}
                    </span>
                  </td>
                  <td>
                    <a href={urlFacturaPdf(f.id_transaccion)} target="_blank" rel="noopener noreferrer" className="btn btn-azul">
                      Ver
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default Clientes
