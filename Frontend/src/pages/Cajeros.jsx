import { useEffect, useState } from 'react'
import { listarCajeros, listarMisFacturas, urlFacturaPdf } from '../api/pagos.js'

// TDSI-329: el administrador ve todos los cajeros que han trabajado (registraron
// al menos una venta) y, al elegir uno, lo que ha facturado desde que empezó,
// con filtro de fechas.
function Cajeros() {
  const [cajeros, setCajeros] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const [cajeroSeleccionado, setCajeroSeleccionado] = useState(null)
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')
  const [facturas, setFacturas] = useState([])
  const [cargandoFacturas, setCargandoFacturas] = useState(false)
  const [errorFacturas, setErrorFacturas] = useState(null)

  useEffect(() => {
    listarCajeros()
      .then((r) => setCajeros(r.data))
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => {
    if (!cajeroSeleccionado) return
    setCargandoFacturas(true)
    setErrorFacturas(null)
    listarMisFacturas(cajeroSeleccionado, { desde: filtroDesde, hasta: filtroHasta })
      .then((r) => setFacturas(r.data))
      .catch((err) => setErrorFacturas(err.message))
      .finally(() => setCargandoFacturas(false))
  }, [cajeroSeleccionado, filtroDesde, filtroHasta])

  function seleccionarCajero(cajero) {
    setCajeroSeleccionado(cajero)
    setFiltroDesde('')
    setFiltroHasta('')
  }

  return (
    <section>
      <h1>Cajeros</h1>
      <p className="resumen-turno-actual">
        Cajeros que han registrado ventas en el sistema. Elija uno para ver lo que ha facturado.
      </p>

      {cargando && <p>Cargando...</p>}
      {error && <p className="error">Error: {error}</p>}

      {!cargando && !error && cajeros.length === 0 && <p>Todavía no hay ventas registradas por ningún cajero.</p>}

      {cajeros.length > 0 && (
        <table className="tabla-facturas">
          <thead>
            <tr>
              <th>Cajero</th>
              <th>Ventas</th>
              <th>Total facturado (Bs.)</th>
              <th>Última venta</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {cajeros.map((c) => (
              <tr key={c.cajero}>
                <td>{c.cajero}</td>
                <td>{c.cantidadVentas}</td>
                <td>{c.totalFacturado.toFixed(2)}</td>
                <td>{new Date(c.ultimaVenta).toLocaleString()}</td>
                <td>
                  <button
                    type="button"
                    className={`btn${cajeroSeleccionado === c.cajero ? '' : ' btn-secundario'}`}
                    onClick={() => seleccionarCajero(c.cajero)}
                  >
                    Ver facturas
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {cajeroSeleccionado && (
        <div style={{ marginTop: '2rem' }}>
          <h2>Facturas de {cajeroSeleccionado}</h2>

          <div className="filtro-fechas">
            <label className="campo">
              Desde
              <input
                type="date"
                value={filtroDesde}
                max={filtroHasta || undefined}
                onChange={(e) => setFiltroDesde(e.target.value)}
              />
            </label>
            <label className="campo">
              Hasta
              <input
                type="date"
                value={filtroHasta}
                min={filtroDesde || undefined}
                onChange={(e) => setFiltroHasta(e.target.value)}
              />
            </label>
            {(filtroDesde || filtroHasta) && (
              <button
                type="button"
                className="btn btn-secundario"
                onClick={() => {
                  setFiltroDesde('')
                  setFiltroHasta('')
                }}
              >
                Quitar filtro
              </button>
            )}
          </div>

          {cargandoFacturas && <p>Cargando...</p>}
          {errorFacturas && <p className="error">Error: {errorFacturas}</p>}
          {!cargandoFacturas && !errorFacturas && facturas.length === 0 && (
            <p>{filtroDesde || filtroHasta ? 'No hay facturas en ese rango de fechas.' : 'Este cajero todavía no tiene facturas.'}</p>
          )}

          {facturas.length > 0 && (
            <table className="tabla-facturas">
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Método(s)</th>
                  <th>Total (Bs.)</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {facturas.map((f) => (
                  <tr key={f.id_transaccion}>
                    <td>{f.id_transaccion}</td>
                    <td>{new Date(f.fecha).toLocaleString()}</td>
                    <td>{f.razon_social || 'Consumidor final'}</td>
                    <td>{f.metodos.join(' + ')}</td>
                    <td>{f.total.toFixed(2)}</td>
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
          )}
        </div>
      )}
    </section>
  )
}

export default Cajeros
