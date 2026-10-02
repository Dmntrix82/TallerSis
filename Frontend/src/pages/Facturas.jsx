import { useEffect, useState } from 'react'
import { listarMisFacturas, anularVenta, urlFacturaPdf } from '../api/pagos.js'
import { useAuth } from '../context/AuthContext.jsx'

const PLAZO_ANULACION_MS = 2 * 60 * 60 * 1000 // 2 horas

const ESTADOS = {
  Registrado: { texto: 'Emitida', clase: 'badge-estado--emitida' },
  Anulado: { texto: 'Anulada', clase: '' },
}

function dentroDelPlazo(fecha) {
  return Date.now() - new Date(fecha).getTime() <= PLAZO_ANULACION_MS
}

const CREDENCIALES_INICIAL = { supervisor_id: '', pin: '' }

// TDSI-306: el cajero ve solo sus propias ventas y puede anularlas (dentro de 2
// horas) pidiendo el usuario + PIN de un supervisor de caja, con una pregunta
// de seguridad final antes de anular de verdad.
function Facturas() {
  const { cajero } = useAuth()
  const [facturas, setFacturas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(null)
  const [mensaje, setMensaje] = useState(null) // { ok, texto } | null

  // Filtro por rango de fechas (TDSI-307): vacio = sin límite en ese extremo.
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')

  // Paso 1: factura elegida + ventana emergente de credenciales del supervisor.
  const [facturaParaAnular, setFacturaParaAnular] = useState(null)
  const [credenciales, setCredenciales] = useState(CREDENCIALES_INICIAL)
  const [errorCredenciales, setErrorCredenciales] = useState(null)

  // Paso 2: pregunta de seguridad final, antes de anular de verdad.
  const [pidiendoConfirmacion, setPidiendoConfirmacion] = useState(false)
  const [anulando, setAnulando] = useState(false)

  async function cargarFacturas() {
    if (!cajero) return
    setCargando(true)
    try {
      const respuesta = await listarMisFacturas(cajero.nombre, { desde: filtroDesde, hasta: filtroHasta })
      setFacturas(respuesta.data)
      setErrorCarga(null)
    } catch (err) {
      setErrorCarga(err.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargarFacturas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cajero, filtroDesde, filtroHasta])

  function limpiarFiltro() {
    setFiltroDesde('')
    setFiltroHasta('')
  }

  function abrirVentanaCredenciales(factura) {
    setFacturaParaAnular(factura)
    setCredenciales(CREDENCIALES_INICIAL)
    setErrorCredenciales(null)
    setPidiendoConfirmacion(false)
    setMensaje(null)
  }

  function cerrarTodo() {
    setFacturaParaAnular(null)
    setPidiendoConfirmacion(false)
    setErrorCredenciales(null)
  }

  function actualizarCredencial(campo, valor) {
    setCredenciales((prev) => ({ ...prev, [campo]: valor }))
  }

  // Al aceptar las credenciales, todavía no se anula nada: primero se pregunta
  // "¿está seguro?" y recién ahí se llama al backend con el PIN.
  function aceptarCredenciales(event) {
    event.preventDefault()
    if (!credenciales.supervisor_id.trim() || !credenciales.pin.trim()) {
      setErrorCredenciales('Ingrese el usuario y el PIN del supervisor.')
      return
    }
    setErrorCredenciales(null)
    setPidiendoConfirmacion(true)
  }

  async function confirmarAnulacion() {
    setAnulando(true)
    try {
      await anularVenta(facturaParaAnular.id_transaccion, {
        cajero: cajero?.nombre,
        supervisor_id: credenciales.supervisor_id.trim(),
        pin: credenciales.pin.trim(),
      })
      setMensaje({ ok: true, texto: `La factura ${facturaParaAnular.id_transaccion} fue anulada.` })
      cerrarTodo()
      await cargarFacturas()
    } catch (err) {
      // El PIN pudo ser incorrecto o el plazo vencio justo ahora: se vuelve a
      // pedir las credenciales mostrando el motivo, en vez de perder el flujo.
      setPidiendoConfirmacion(false)
      setErrorCredenciales(err.message)
    } finally {
      setAnulando(false)
    }
  }

  return (
    <section>
      <h1>Facturas</h1>
      <p className="resumen-turno-actual">Ventas emitidas por {cajero ? cajero.nombre : 'sin sesión iniciada'}.</p>

      <div className="filtro-fechas">
        <label className="campo">
          Desde
          <input type="date" value={filtroDesde} max={filtroHasta || undefined} onChange={(e) => setFiltroDesde(e.target.value)} />
        </label>
        <label className="campo">
          Hasta
          <input type="date" value={filtroHasta} min={filtroDesde || undefined} onChange={(e) => setFiltroHasta(e.target.value)} />
        </label>
        {(filtroDesde || filtroHasta) && (
          <button type="button" className="btn btn-secundario" onClick={limpiarFiltro}>
            Quitar filtro
          </button>
        )}
      </div>

      {mensaje && <p className={mensaje.ok ? 'mensaje-exito' : 'error'}>{mensaje.texto}</p>}

      {cargando && <p>Cargando...</p>}
      {errorCarga && <p className="error">Error: {errorCarga}</p>}

      {!cargando && !errorCarga && facturas.length === 0 && (
        <p>{filtroDesde || filtroHasta ? 'No hay facturas en ese rango de fechas.' : 'Todavía no emitiste ninguna factura.'}</p>
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
            {facturas.map((factura) => {
              const estado = ESTADOS[factura.estado] ?? { texto: factura.estado, clase: '' }
              const puedeAnular = factura.estado !== 'Anulado' && dentroDelPlazo(factura.fecha)
              return (
                <tr key={factura.id_transaccion}>
                  <td>{factura.id_transaccion}</td>
                  <td>{new Date(factura.fecha).toLocaleString()}</td>
                  <td>{factura.razon_social || 'Consumidor final'}</td>
                  <td>{factura.metodos.join(' + ')}</td>
                  <td>{factura.total.toFixed(2)}</td>
                  <td>
                    <span className={`badge-estado ${estado.clase}`}>{estado.texto}</span>
                  </td>
                  <td style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <a href={urlFacturaPdf(factura.id_transaccion)} target="_blank" rel="noopener noreferrer" className="btn btn-azul">
                      Ver
                    </a>
                    {puedeAnular && (
                      <button type="button" className="btn btn-secundario" onClick={() => abrirVentanaCredenciales(factura)}>
                        Anular factura
                      </button>
                    )}
                    {factura.estado !== 'Anulado' && !dentroDelPlazo(factura.fecha) && (
                      <span style={{ fontSize: '0.8rem', color: '#616e7c' }}>Fuera de plazo (2h)</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {/* Ventana emergente 1: usuario + PIN del supervisor de caja */}
      {facturaParaAnular && !pidiendoConfirmacion && (
        <div className="modal-overlay">
          <form className="modal-caja" onSubmit={aceptarCredenciales}>
            <h2>Autorización de supervisor</h2>
            <p>
              Para anular la factura <strong>{facturaParaAnular.id_transaccion}</strong> se necesita el usuario y el PIN
              de un supervisor de caja.
            </p>

            <label className="campo">
              Usuario del supervisor
              <input
                type="text"
                autoComplete="off"
                value={credenciales.supervisor_id}
                onChange={(e) => actualizarCredencial('supervisor_id', e.target.value)}
                autoFocus
              />
            </label>

            <label className="campo">
              PIN
              <input
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                value={credenciales.pin}
                onChange={(e) => actualizarCredencial('pin', e.target.value)}
              />
            </label>

            {errorCredenciales && <p className="error">{errorCredenciales}</p>}

            <div className="pago-exito-acciones">
              <button type="button" className="btn btn-secundario" onClick={cerrarTodo}>
                Cancelar
              </button>
              <button type="submit" className="btn">
                Aceptar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Ventana emergente 2: pregunta de seguridad final antes de anular de verdad */}
      {facturaParaAnular && pidiendoConfirmacion && (
        <div className="modal-overlay">
          <div className="modal-caja">
            <h2>¿Está seguro?</h2>
            <p>
              ¿Desea anular la factura número <strong>{facturaParaAnular.id_transaccion}</strong>? Esta acción no se
              puede deshacer.
            </p>

            <div className="pago-exito-acciones">
              <button type="button" className="btn btn-secundario" onClick={cerrarTodo} disabled={anulando}>
                No
              </button>
              <button type="button" className="btn" onClick={confirmarAnulacion} disabled={anulando}>
                {anulando ? 'Anulando...' : 'Sí, anular'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default Facturas
