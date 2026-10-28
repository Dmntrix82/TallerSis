import { useEffect, useState } from 'react'
import { listarMisFacturas, anularVenta, modificarVenta, urlFacturaPdf } from '../api/pagos.js'
import { useAuth } from '../context/AuthContext.jsx'

const PLAZO_ANULACION_MS = 2 * 60 * 60 * 1000 // 2 horas

const ESTADOS = {
  Registrado: { texto: 'Emitida', clase: 'badge-estado--emitida' },
  AnulacionSolicitada: { texto: 'Anulación solicitada', clase: 'badge-estado--solicitada' },
  Anulado: { texto: 'Anulada', clase: '' },
}

function dentroDelPlazo(fecha) {
  return Date.now() - new Date(fecha).getTime() <= PLAZO_ANULACION_MS
}

// TDSI-37/569: "1h 23m restantes" a partir de la fecha de emision.
function tiempoRestanteTexto(fecha) {
  const msRestante = PLAZO_ANULACION_MS - (Date.now() - new Date(fecha).getTime())
  if (msRestante <= 0) return null
  const minutosTotales = Math.floor(msRestante / 60000)
  const horas = Math.floor(minutosTotales / 60)
  const minutos = minutosTotales % 60
  return horas > 0 ? `${horas}h ${minutos}m restantes` : `${minutos}m restantes`
}

const CREDENCIALES_INICIAL = { supervisor_id: '', pin: '' }
const TIPOS_DOCUMENTO_MOD = [
  { id: 'NIT', etiqueta: 'NIT' },
  { id: 'CI', etiqueta: 'CI' },
]
const REGEX_DOCUMENTO_MOD = { NIT: /^\d{10}$/, CI: /^\d{7,8}$/ }
const MAX_LARGO_DOCUMENTO_MOD = { NIT: 10, CI: 8 }

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

  // TDSI-37: modificar los datos de facturacion de una venta ya registrada
  // (ej. un NIT mal escrito), autorizado por un supervisor, dentro de 2 horas.
  const [facturaParaModificar, setFacturaParaModificar] = useState(null)
  const [formModificar, setFormModificar] = useState(null)
  const [credencialesModificar, setCredencialesModificar] = useState(CREDENCIALES_INICIAL)
  const [errorModificar, setErrorModificar] = useState(null)
  const [modificando, setModificando] = useState(false)
  const [tiempoRestante, setTiempoRestante] = useState(null)

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

  function abrirModificar(factura) {
    setFacturaParaModificar(factura)
    setFormModificar({
      tipoDocumento: factura.tipo_documento || 'NIT',
      numeroDocumento: factura.nit || '',
      razonSocial: factura.razon_social || '',
      telefono: factura.telefono || '',
    })
    setCredencialesModificar(CREDENCIALES_INICIAL)
    setErrorModificar(null)
    setTiempoRestante(tiempoRestanteTexto(factura.fecha))
    setMensaje(null)
  }

  function cerrarModificar() {
    setFacturaParaModificar(null)
    setFormModificar(null)
    setErrorModificar(null)
  }

  function actualizarFormModificar(campo, valor) {
    setFormModificar((prev) => ({ ...prev, [campo]: valor }))
  }

  function actualizarCredencialModificar(campo, valor) {
    setCredencialesModificar((prev) => ({ ...prev, [campo]: valor }))
  }

  // TDSI-37/569: mientras el modal esta abierto, el tiempo restante se actualiza
  // solo cada segundo, y se bloquea el envio apenas pasan las 2 horas.
  useEffect(() => {
    if (!facturaParaModificar) return
    const intervalo = setInterval(() => {
      setTiempoRestante(tiempoRestanteTexto(facturaParaModificar.fecha))
    }, 1000)
    return () => clearInterval(intervalo)
  }, [facturaParaModificar])

  async function enviarModificacion(event) {
    event.preventDefault()
    if (!tiempoRestante) {
      setErrorModificar('Ya pasaron las 2 horas desde la emisión; esta factura ya no se puede modificar.')
      return
    }
    if (!credencialesModificar.supervisor_id.trim() || !credencialesModificar.pin.trim()) {
      setErrorModificar('Ingrese el usuario y el PIN del supervisor.')
      return
    }
    if (!formModificar.numeroDocumento.trim() || !formModificar.razonSocial.trim()) {
      setErrorModificar('Complete el número de documento y la razón social.')
      return
    }
    if (!REGEX_DOCUMENTO_MOD[formModificar.tipoDocumento].test(formModificar.numeroDocumento.trim())) {
      setErrorModificar(
        formModificar.tipoDocumento === 'NIT' ? 'El NIT debe tener exactamente 10 dígitos.' : 'El CI debe tener entre 7 y 8 dígitos.',
      )
      return
    }

    setModificando(true)
    setErrorModificar(null)
    try {
      await modificarVenta(facturaParaModificar.id_transaccion, {
        supervisor_id: credencialesModificar.supervisor_id.trim(),
        pin: credencialesModificar.pin.trim(),
        modificado_por: cajero?.nombre,
        tipo_documento: formModificar.tipoDocumento,
        nit: formModificar.numeroDocumento.trim(),
        razon_social: formModificar.razonSocial.trim(),
        telefono: formModificar.telefono.trim() || null,
      })
      setMensaje({ ok: true, texto: `La factura ${facturaParaModificar.id_transaccion} fue modificada correctamente.` })
      cerrarModificar()
      await cargarFacturas()
    } catch (err) {
      // TDSI-570: PIN incorrecto o fuera de plazo -- se muestra el error y no se modifica nada.
      setErrorModificar(err.message)
    } finally {
      setModificando(false)
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
              const puedeAnular = factura.estado === 'Registrado' && dentroDelPlazo(factura.fecha)
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
                    {puedeAnular && (
                      <button type="button" className="btn btn-azul" onClick={() => abrirModificar(factura)}>
                        Modificar factura
                      </button>
                    )}
                    {factura.estado === 'AnulacionSolicitada' && (
                      <span style={{ fontSize: '0.8rem', color: '#616e7c' }}>Esperando a un supervisor...</span>
                    )}
                    {factura.estado === 'Registrado' && !dentroDelPlazo(factura.fecha) && (
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

      {/* TDSI-37: modificar los datos de facturacion de una venta, con PIN de supervisor */}
      {facturaParaModificar && formModificar && (
        <div className="modal-overlay">
          <form className="modal-caja" onSubmit={enviarModificacion}>
            <h2>Modificar factura {facturaParaModificar.id_transaccion}</h2>

            {tiempoRestante ? (
              <p className="ayuda-mixto">{tiempoRestante} para poder modificar esta factura.</p>
            ) : (
              <p className="error">Ya pasaron las 2 horas desde la emisión: no se puede modificar.</p>
            )}

            <div className="tipo-venta-opciones">
              {TIPOS_DOCUMENTO_MOD.map((tipo) => (
                <button
                  key={tipo.id}
                  type="button"
                  className={`tipo-venta-opcion${formModificar.tipoDocumento === tipo.id ? ' activa' : ''}`}
                  onClick={() => actualizarFormModificar('tipoDocumento', tipo.id)}
                >
                  {tipo.etiqueta}
                </button>
              ))}
            </div>

            <label className="campo">
              Número de {formModificar.tipoDocumento}
              <input
                type="text"
                inputMode="numeric"
                maxLength={MAX_LARGO_DOCUMENTO_MOD[formModificar.tipoDocumento]}
                value={formModificar.numeroDocumento}
                onChange={(e) => actualizarFormModificar('numeroDocumento', e.target.value.replace(/\D/g, ''))}
              />
            </label>

            <label className="campo">
              Razón social
              <input
                type="text"
                value={formModificar.razonSocial}
                onChange={(e) => actualizarFormModificar('razonSocial', e.target.value)}
              />
            </label>

            <label className="campo">
              Teléfono (opcional)
              <input
                type="tel"
                value={formModificar.telefono}
                onChange={(e) => actualizarFormModificar('telefono', e.target.value)}
              />
            </label>

            <label className="campo">
              Usuario del supervisor
              <input
                type="text"
                autoComplete="off"
                value={credencialesModificar.supervisor_id}
                onChange={(e) => actualizarCredencialModificar('supervisor_id', e.target.value)}
              />
            </label>

            <label className="campo">
              PIN
              <input
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                value={credencialesModificar.pin}
                onChange={(e) => actualizarCredencialModificar('pin', e.target.value)}
              />
            </label>

            {errorModificar && <p className="error">{errorModificar}</p>}

            <div className="pago-exito-acciones">
              <button type="button" className="btn btn-secundario" onClick={cerrarModificar} disabled={modificando}>
                Cancelar
              </button>
              <button type="submit" className="btn" disabled={modificando || !tiempoRestante}>
                {modificando ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}

export default Facturas
