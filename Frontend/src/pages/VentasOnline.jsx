import { useEffect, useState } from 'react'
import { listarVentasOnline } from '../api/ventasOnline.js'

const ESTADOS = [
  { valor: '', etiqueta: 'Todos' },
  { valor: 'Pagado', etiqueta: 'Pagado' },
  { valor: 'Anulacion Pendiente', etiqueta: 'Anulación pendiente' },
  { valor: 'Anulado', etiqueta: 'Anulado' },
]

const CLASE_ESTADO = {
  Pagado: 'badge-estado--emitida',
  Anulado: '',
  'Anulacion Pendiente': 'badge-estado--solicitada',
}

const bs = (v) => Number(v ?? 0).toFixed(2)
const FILTROS_VACIOS = { desde: '', hasta: '', estado: '' }

// TDSI-180/688-691: pantalla "Ventas Online" del Administrador -- ventas reales
// que llegan del Marketplace (topico o POST /api/pagos/online), su factura emitida
// y si el aviso de esa factura ya llego al Marketplace.
function VentasOnline() {
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [estado, setEstado] = useState('')
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)

  const [ventas, setVentas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const [ventaSeleccionada, setVentaSeleccionada] = useState(null)

  useEffect(() => {
    let vigente = true
    setCargando(true)
    setError(null)
    listarVentasOnline(filtros)
      .then((r) => vigente && setVentas(r.data))
      .catch((err) => vigente && setError(err.message))
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [filtros])

  function buscar(event) {
    event.preventDefault()
    setFiltros({ desde, hasta, estado })
  }

  function limpiar() {
    setDesde('')
    setHasta('')
    setEstado('')
    setFiltros(FILTROS_VACIOS)
  }

  const hayFiltros = filtros.desde || filtros.hasta || filtros.estado

  return (
    <section>
      <h1>Ventas Online</h1>
      <p className="resumen-turno-actual">
        Órdenes recibidas del Marketplace, su factura emitida y el aviso enviado de vuelta.
      </p>

      <form className="filtro-fechas" onSubmit={buscar}>
        <label className="campo">
          Desde
          <input type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label className="campo">
          Hasta
          <input type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} />
        </label>
        <label className="campo campo-turno-dia">
          Estado
          <select value={estado} onChange={(e) => setEstado(e.target.value)}>
            {ESTADOS.map((o) => (
              <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn">Buscar</button>
        {hayFiltros && (
          <button type="button" className="btn btn-secundario" onClick={limpiar}>Limpiar</button>
        )}
      </form>

      {cargando && <p>Cargando...</p>}
      {!cargando && error && <p className="error">Error: {error}</p>}

      {!cargando && !error && ventas.length === 0 && (
        <p className="orden-mensaje orden-mensaje-pendiente cajas-mensaje">
          No hay ventas del Marketplace en este rango.
        </p>
      )}

      {!cargando && !error && ventas.length > 0 && (
        <div className="reporte-tabla">
          <table className="tabla-facturas">
            <thead>
              <tr>
                <th>N° Orden</th>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Total (Bs.)</th>
                <th>Método</th>
                <th>N° Factura</th>
                <th>Aviso al Marketplace</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ventas.map((v) => (
                <tr key={v.id}>
                  <td>{v.orden_id}</td>
                  <td>{new Date(v.recibida_en).toLocaleString()}</td>
                  <td>{v.razon_social || v.cliente_id || 'Consumidor final'}</td>
                  <td>{bs(v.total)}</td>
                  <td>{v.metodo_pago}</td>
                  <td>
                    {v.numero_factura || (
                      <span className="error" style={{ fontSize: '0.8rem' }}>{v.factura_error ? 'Error al emitir' : 'Pendiente'}</span>
                    )}
                  </td>
                  <td>
                    {v.aviso_marketplace_estado ? (
                      <span className={`badge-estado ${v.aviso_marketplace_estado === 'Enviado' ? 'badge-estado--emitida' : ''}`}>
                        {v.aviso_marketplace_estado}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <span className={`badge-estado ${CLASE_ESTADO[v.estado] ?? ''}`}>{v.estado}</span>
                  </td>
                  <td>
                    <button type="button" className="btn btn-azul" onClick={() => setVentaSeleccionada(v)}>
                      Ver factura
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ventaSeleccionada && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={`Factura de la orden ${ventaSeleccionada.orden_id}`}>
          <div className="rt-modal-facturas">
            <button
              type="button"
              className="rt-modal-cerrar"
              onClick={() => setVentaSeleccionada(null)}
              aria-label="Cerrar"
            >
              ✕
            </button>

            <h3 style={{ marginTop: 0 }}>
              Factura {ventaSeleccionada.numero_factura || '(pendiente de emitir)'}
            </h3>
            <p className="resumen-turno-actual" style={{ marginTop: '-0.5rem' }}>
              Orden {ventaSeleccionada.orden_id} · {new Date(ventaSeleccionada.recibida_en).toLocaleString()}
            </p>
            <p>
              <strong>Cliente:</strong> {ventaSeleccionada.razon_social || ventaSeleccionada.cliente_id || 'Consumidor final'}
              {ventaSeleccionada.nit && ` · ${ventaSeleccionada.tipo_documento || 'NIT'} ${ventaSeleccionada.nit}`}
            </p>

            <table className="tabla-facturas">
              <thead>
                <tr>
                  <th>Ítem</th>
                  <th>Cantidad</th>
                  <th>Precio unit. (Bs.)</th>
                  <th>Subtotal (Bs.)</th>
                </tr>
              </thead>
              <tbody>
                {ventaSeleccionada.items.map((it, i) => (
                  <tr key={it.sku ?? i}>
                    <td>{it.descripcion || it.sku}</td>
                    <td>{it.cantidad}</td>
                    <td>{bs(it.precio_unitario)}</td>
                    <td>{bs(it.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}><strong>Total</strong></td>
                  <td><strong>{bs(ventaSeleccionada.total)}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}

export default VentasOnline
