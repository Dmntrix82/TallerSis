import { useEffect, useState } from 'react'
import { listarVentasOnline, reenviarAvisoMarketplace } from '../api/ventasOnline.js'

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

// TDSI-51: estado del correo con la factura digital que se le manda al cliente final
// (distinto del aviso al Marketplace, que solo avisa que ya se emitio el numero).
const ETIQUETA_FACTURA_EMAIL = { ENVIADO: 'Enviado', SIMULADO: 'Simulado (sin SMTP)', ERROR: 'Error' }
const CLASE_FACTURA_EMAIL = { ENVIADO: 'badge-estado--emitida', SIMULADO: '', ERROR: 'badge-comparacion--faltante' }

const bs = (v) => Number(v ?? 0).toFixed(2)
const FILTROS_VACIOS = { desde: '', hasta: '', estado: '' }

// TDSI-180/688-691/957: pantalla "Ventas Online" del Administrador -- ventas reales
// que llegan del Marketplace (topico o POST /api/pagos/online). La factura se arma y
// se le manda al cliente por correo apenas llega la orden; el aviso de vuelta al
// Marketplace (Pub/Sub) queda pendiente de que el Administrador revise la factura en
// "Ver factura" y la apruebe.
function VentasOnline() {
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [estado, setEstado] = useState('')
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)

  const [ventas, setVentas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const [ventaSeleccionada, setVentaSeleccionada] = useState(null)
  const [enviandoMarketplace, setEnviandoMarketplace] = useState(false)
  const [errorMarketplace, setErrorMarketplace] = useState(null)

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

  function abrirFactura(venta) {
    setVentaSeleccionada(venta)
    setErrorMarketplace(null)
  }

  function cerrarFactura() {
    setVentaSeleccionada(null)
    setErrorMarketplace(null)
  }

  // TDSI-51/957: ni el aviso al Marketplace ni la factura por correo al cliente se
  // mandan solos al emitir la factura -- el Administrador la revisa primero en este
  // modal y recien al aprobarla (este boton) se publica de verdad por Pub/Sub y,
  // si la orden trajo correo, se le manda ademas la factura digital al cliente.
  async function enviarAMarketplace() {
    if (!ventaSeleccionada?.numero_factura) return
    const { id } = ventaSeleccionada
    setEnviandoMarketplace(true)
    setErrorMarketplace(null)
    try {
      const { data } = await reenviarAvisoMarketplace(id)
      const nuevoEstado = data.publicado ? 'Enviado' : 'Error'
      const nuevoEstadoCorreo = data.facturaEmail?.envio?.estado
      setVentaSeleccionada((v) => (v ? { ...v, aviso_marketplace_estado: nuevoEstado, ...(nuevoEstadoCorreo && { factura_email_estado: nuevoEstadoCorreo }) } : v))
      setVentas((lista) => lista.map((v) => (v.id === id ? { ...v, aviso_marketplace_estado: nuevoEstado, ...(nuevoEstadoCorreo && { factura_email_estado: nuevoEstadoCorreo }) } : v)))
      if (!data.publicado) setErrorMarketplace(data.error || 'No se pudo publicar el aviso en Pub/Sub.')
    } catch (err) {
      setErrorMarketplace(err.message)
    } finally {
      setEnviandoMarketplace(false)
    }
  }

  const hayFiltros = filtros.desde || filtros.hasta || filtros.estado

  return (
    <section>
      <h1>Ventas Online</h1>
      <p className="resumen-turno-actual">
        Órdenes recibidas del Marketplace y su factura, ya emitida. El aviso de vuelta al
        Marketplace (y, si la orden trajo correo, el envío de la factura al cliente) queda
        pendiente de tu aprobación en "Ver factura".
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
                <th>Correo</th>
                <th>Total (Bs.)</th>
                <th>Método</th>
                <th>N° Factura</th>
                <th>Aviso al Marketplace</th>
                <th>Factura por correo</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ventas.map((v) => (
                <tr key={v.id}>
                  <td className="celda-truncada" title={v.orden_id}>{v.orden_id}</td>
                  <td>{new Date(v.recibida_en).toLocaleString()}</td>
                  <td>{v.razon_social || v.cliente_id || 'Consumidor final'}</td>
                  <td className="celda-truncada" title={v.email || ''}>{v.email || '—'}</td>
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
                    ) : v.numero_factura ? (
                      <span className="badge-estado badge-estado--solicitada">Pendiente de aprobación</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {v.factura_email_estado ? (
                      <span className={`badge-estado ${CLASE_FACTURA_EMAIL[v.factura_email_estado] ?? ''}`}>
                        {ETIQUETA_FACTURA_EMAIL[v.factura_email_estado] ?? v.factura_email_estado}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <span className={`badge-estado ${CLASE_ESTADO[v.estado] ?? ''}`}>{v.estado}</span>
                  </td>
                  <td>
                    <button type="button" className="btn btn-azul" onClick={() => abrirFactura(v)}>
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
              onClick={cerrarFactura}
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

            {/* TDSI-51/957: el aviso Pub/Sub al Marketplace no sale solo -- recien se
                publica cuando el Administrador revisa esta factura y la aprueba aca. */}
            <div
              style={{
                margin: '0.75rem 0 1.25rem',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                backgroundColor: '#f4f6fa',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.75rem',
                alignItems: 'center',
              }}
            >
              <button
                type="button"
                className="btn"
                onClick={enviarAMarketplace}
                disabled={!ventaSeleccionada.numero_factura || ventaSeleccionada.aviso_marketplace_estado === 'Enviado' || enviandoMarketplace}
                title={!ventaSeleccionada.numero_factura ? 'Todavía no tiene una factura emitida' : undefined}
              >
                {enviandoMarketplace ? 'Enviando...' : 'Aprobar y enviar a Marketplace (Pub/Sub)'}
              </button>
              {ventaSeleccionada.aviso_marketplace_estado ? (
                <span className={`badge-estado ${ventaSeleccionada.aviso_marketplace_estado === 'Enviado' ? 'badge-estado--emitida' : ''}`}>
                  {ventaSeleccionada.aviso_marketplace_estado}
                </span>
              ) : ventaSeleccionada.numero_factura ? (
                <span className="resumen-turno-actual" style={{ margin: 0 }}>
                  Revisa la factura y aprueba para avisarle al Marketplace
                  {ventaSeleccionada.email ? ' y mandarle la factura al cliente por correo.' : '.'}
                </span>
              ) : null}
            </div>
            {errorMarketplace && <p className="error" style={{ marginTop: '-0.5rem' }}>{errorMarketplace}</p>}

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
