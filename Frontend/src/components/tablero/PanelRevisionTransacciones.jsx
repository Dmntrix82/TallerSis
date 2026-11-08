import { useCallback, useEffect, useRef, useState } from 'react'
import '../../App.css'

const BASE_URL = import.meta.env.VITE_GESTION_PAGOS_API_BASE_URL || 'http://localhost:4005'
const REVISION_BASE_URL = `${BASE_URL}/api/pagos/revision`
const CAJEROS_URL = `${REVISION_BASE_URL}/cajeros`
const TRANSACCIONES_URL = `${REVISION_BASE_URL}/transacciones`
const RESUMEN_URL = `${REVISION_BASE_URL}/resumen`
const revisionUrl = (id) => `${TRANSACCIONES_URL}/${id}`
const POR_PAGINA = 10

const fechaHoy = () => {
  const hoy = new Date()
  const offset = hoy.getTimezoneOffset()
  return new Date(hoy.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

const formatearMoneda = (valor) =>
  new Intl.NumberFormat('es-BO', {
    style: 'currency',
    currency: 'BOB',
    minimumFractionDigits: 2,
  }).format(Number(valor) || 0)

const formatearHora = (valor) => {
  if (!valor) return '—'
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return String(valor)
  return fecha.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const obtenerMensajeError = (error) => {
  const status = error?.status
  if (status === 404) return 'No se encontró la transacción solicitada.'
  if (status === 502 || status === 503) return 'El servicio no está disponible por el momento.'
  if (status) return error?.message || 'No se pudo completar la operación.'
  return 'No se pudo conectar con el servidor. Verifique su conexión.'
}

// Estados del backend: PENDIENTE (sin revisar), REVISADA, OBSERVADA
const ESTADOS = {
  PENDIENTE: { etiqueta: 'Sin revisar', clase: 'rt-estado-sin-revisar' },
  REVISADA: { etiqueta: 'Revisada', clase: 'rt-estado-revisada' },
  OBSERVADA: { etiqueta: 'Observada', clase: 'rt-estado-observada' },
}

const idTx = (t) => t?.id_transaccion
const estadoTx = (t) => t?.revision?.estado || 'PENDIENTE'
const notaTx = (t) => t?.revision?.nota || ''

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })

  let data = null
  try {
    data = await response.json()
  } catch {}

  if (!response.ok) {
    const error = new Error(
      data?.mensaje || data?.message || data?.detalle?.mensaje || 'Ocurrió un error al comunicarse con el servidor.'
    )
    error.status = response.status
    error.data = data
    throw error
  }

  return data
}

export default function PanelRevisionTransacciones() {
  const [cajeros, setCajeros] = useState([])
  const [cargandoCajeros, setCargandoCajeros] = useState(true)
  const [errorCajeros, setErrorCajeros] = useState('')
  const [cajeroId, setCajeroId] = useState('')
  const [fecha, setFecha] = useState(fechaHoy)

  const [transacciones, setTransacciones] = useState([])
  const [resumen, setResumen] = useState(null)
  const [paginacion, setPaginacion] = useState({ pagina: 1, total_paginas: 1, total_registros: 0 })
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [metodo, setMetodo] = useState('')
  const [pagina, setPagina] = useState(1)

  const [seleccion, setSeleccion] = useState(null)
  const [estadoNuevo, setEstadoNuevo] = useState('REVISADA')
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errorModal, setErrorModal] = useState('')
  const [exito, setExito] = useState('')

  const peticionTx = useRef(0)

  // 1. Cargar lista de cajeros que tuvieron ventas en la fecha seleccionada
  useEffect(() => {
    let activo = true
    ;(async () => {
      setCargandoCajeros(true)
      try {
        const res = await requestJson(`${CAJEROS_URL}?fecha=${fecha}`)
        const datos = res?.data ?? res
        if (activo) setCajeros(Array.isArray(datos) ? datos : datos?.cajeros ?? [])
      } catch (err) {
        if (activo) setErrorCajeros(obtenerMensajeError(err))
      } finally {
        if (activo) setCargandoCajeros(false)
      }
    })()
    return () => { activo = false }
  }, [fecha])

  // 2. Cargar transacciones (paginadas y filtradas desde el backend)
  const cargarTransacciones = useCallback(async () => {
    if (!cajeroId || !fecha) {
      setTransacciones([])
      return
    }
    const actual = ++peticionTx.current
    setCargando(true)
    setError('')
    try {
      const params = new URLSearchParams({ cajero_id: cajeroId, fecha, pagina, por_pagina: POR_PAGINA })
      if (metodo) params.append('metodo', metodo)

      const res = await requestJson(`${TRANSACCIONES_URL}?${params}`)
      if (actual !== peticionTx.current) return
      const datos = res?.data ?? res
      setTransacciones(datos.transacciones ?? [])
      setPaginacion(datos.paginacion ?? { pagina: 1, total_paginas: 1, total_registros: 0 })
    } catch (err) {
      if (actual !== peticionTx.current) return
      setTransacciones([])
      setError(obtenerMensajeError(err))
    } finally {
      if (actual === peticionTx.current) setCargando(false)
    }
  }, [cajeroId, fecha, metodo, pagina])

  useEffect(() => {
    cargarTransacciones()
  }, [cargarTransacciones])

  // 3. Cargar el resumen general del cajero (independiente de la paginación)
  const cargarResumen = useCallback(async () => {
    if (!cajeroId || !fecha) {
      setResumen(null)
      return
    }
    try {
      const res = await requestJson(`${RESUMEN_URL}?cajero_id=${cajeroId}&fecha=${fecha}`)
      setResumen(res?.data ?? res)
    } catch (err) {
      setResumen(null)
    }
  }, [cajeroId, fecha])

  useEffect(() => {
    cargarResumen()
  }, [cargarResumen])

  const cajeroSeleccionado = cajeros.find((c) => String(c.cajero_id) === String(cajeroId))
  const nombreCajero = cajeroSeleccionado?.cajero ?? ''

  const cambiarCajero = (valor) => {
    setCajeroId(valor)
    setMetodo('')
    setPagina(1)
    setExito('')
  }

  const cambiarFecha = (valor) => {
    setFecha(valor)
    setMetodo('')
    setPagina(1)
    setExito('')
  }

  const abrirRevision = (transaccion) => {
    const estadoActual = estadoTx(transaccion)
    setSeleccion(transaccion)
    setEstadoNuevo(estadoActual === 'OBSERVADA' ? 'OBSERVADA' : 'REVISADA')
    setNota(notaTx(transaccion))
    setErrorModal('')
    setExito('')
  }

  const guardarRevision = async (event) => {
    event.preventDefault()
    const notaLimpia = nota.trim()

    if (estadoNuevo === 'OBSERVADA' && !notaLimpia) {
      setErrorModal('La nota es obligatoria para marcar la transacción como observada.')
      return
    }

    const id = idTx(seleccion)
    setGuardando(true)
    setErrorModal('')
    try {
      // Usamos PUT como indica revisionRoutes.js
      const res = await requestJson(revisionUrl(id), {
        method: 'PUT',
        body: JSON.stringify({ estado: estadoNuevo, nota: notaLimpia || null, revisado_por: 'admin' }),
      })
      const actualizado = res?.data ?? res

      // Actualizamos la fila en la tabla sin recargar la página
      setTransacciones((previas) =>
        previas.map((t) =>
          idTx(t) === id
            ? { ...t, revision: { estado: actualizado.estado, nota: actualizado.nota, revisado_por: actualizado.revisado_por } }
            : t
        )
      )
      setExito(`Transacción #${id} marcada como ${ESTADOS[estadoNuevo].etiqueta.toLowerCase()}.`)
      setSeleccion(null)
      // Refrescamos el resumen para actualizar los contadores
      cargarResumen()
    } catch (err) {
      setErrorModal(obtenerMensajeError(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section className="revision-transacciones">
      <header className="rt-header">
        <div className="rt-icono" aria-hidden="true">✓</div>
        <div>
          <p className="rt-eyebrow">AUDITORÍA / CAJA</p>
          <h2>Transacciones por cajero</h2>
          <p className="rt-descripcion">Mira lo que hizo cada cajero, cualquier día, y marca lo que necesite una nota.</p>
        </div>
      </header>

      <section className="rt-panel" aria-labelledby="rt-filtros-titulo">
        <h2 id="rt-filtros-titulo">Filtros</h2>
        <div className="rt-filtros">
          <label className="rt-campo">
            Cajero
            <select value={cajeroId} onChange={(e) => cambiarCajero(e.target.value)} disabled={cargandoCajeros}>
              <option value="">{cargandoCajeros ? 'Cargando cajeros...' : 'Selecciona un cajero'}</option>
              {cajeros.map((c) => (
                <option key={c.cajero_id} value={c.cajero_id}>{c.cajero}</option>
              ))}
            </select>
          </label>
          <label className="rt-campo">
            Fecha
            <input type="date" value={fecha} onChange={(e) => cambiarFecha(e.target.value)} required />
          </label>
          <label className="rt-campo">
            Método de pago
            <select value={metodo} onChange={(e) => { setMetodo(e.target.value); setPagina(1) }} disabled={!resumen}>
              <option value="">Todos</option>
              {resumen?.por_metodo?.map((m) => (
                <option key={m.metodo} value={m.metodo}>{m.metodo}</option>
              ))}
            </select>
          </label>
        </div>
        {errorCajeros && <p className="rt-error-linea" role="alert">No se pudieron cargar los cajeros: {errorCajeros}</p>}
      </section>

      {!cajeroId && (
        <div className="rt-vacio">
          <strong>Selecciona un cajero</strong>
          <p>Elige un cajero y una fecha para ver sus transacciones en una ventana emergente.</p>
        </div>
      )}

      {/* Al elegir un cajero, sus transacciones se muestran en una ventana emergente
          (antes quedaban mas abajo en la pagina y habia que bajar a verlas). */}
      {cajeroId && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={`Transacciones de ${nombreCajero || 'cajero'}`}>
          <div className="rt-modal-facturas">
            <button
              type="button"
              className="rt-modal-cerrar"
              onClick={() => cambiarCajero('')}
              aria-label="Cerrar"
            >
              ✕
            </button>

            {exito && (
              <div className="rt-alerta rt-alerta-exito" role="status">
                <span aria-hidden="true">✓</span><strong>{exito}</strong>
              </div>
            )}

            {error && (
              <div className="rt-alerta rt-alerta-error" role="alert">
                <span aria-hidden="true">!</span>
                <div>
                  <strong>No se pudieron cargar las transacciones</strong>
                  <p>{error}</p>
                </div>
                <button className="btn btn-secundario btn-pequeno" type="button" onClick={cargarTransacciones}>Reintentar</button>
              </div>
            )}

            {cargando && (
              <div aria-live="polite" aria-label="Cargando transacciones">
                {[1, 2, 3, 4].map((i) => <div className="rt-skeleton" key={i} />)}
              </div>
            )}

            {!cargando && !error && (
              <>
                <section className="rt-resumen" aria-label="Resumen del cajero">
                  <div className="rt-resumen-item rt-resumen-principal">
                    <span>{nombreCajero || 'Cajero'} · {fecha}</span>
                    <strong>{formatearMoneda(resumen?.total)}</strong>
                    <small>{resumen?.cantidad_transacciones || 0} {(resumen?.cantidad_transacciones === 1) ? 'transacción' : 'transacciones'}</small>
                  </div>
                  <div className="rt-resumen-item"><span>Sin revisar</span><strong>{resumen?.revision?.sin_revisar || 0}</strong></div>
                  <div className="rt-resumen-item"><span>Revisadas</span><strong>{resumen?.revision?.revisadas || 0}</strong></div>
                  <div className="rt-resumen-item"><span>Observadas</span><strong>{resumen?.revision?.observadas || 0}</strong></div>
                </section>

                {transacciones.length === 0 ? (
                  <div className="rt-vacio">
                    <strong>Sin transacciones</strong>
                    <p>
                      {metodo
                        ? `No hay transacciones con el método "${metodo}" para esta fecha.`
                        : 'Este cajero no registró transacciones en la fecha seleccionada.'}
                    </p>
                  </div>
                ) : (
                  <section className="rt-panel">
                    <div className="rt-tabla-contenedor">
                      <table className="rt-tabla">
                        <thead>
                          <tr>
                            <th>Hora</th>
                            <th>Método</th>
                            <th className="rt-derecha">Monto</th>
                            <th>Estado de revisión</th>
                            <th aria-label="Acciones" />
                          </tr>
                        </thead>
                        <tbody>
                          {transacciones.map((t) => {
                            const clave = estadoTx(t)
                            const { etiqueta, clase } = ESTADOS[clave]
                            const notaActual = notaTx(t)
                            return (
                              <tr key={idTx(t)}>
                                <td className="rt-hora">{formatearHora(t.hora ?? t.fecha)}</td>
                                <td className="rt-metodo">{Array.isArray(t.metodos) ? t.metodos.join(', ') : t.metodos}</td>
                                <td className="rt-derecha rt-monto">{formatearMoneda(t.total)}</td>
                                <td>
                                  <span className={`rt-estado ${clase}`}><span aria-hidden="true" />{etiqueta}</span>
                                  {clave === 'OBSERVADA' && notaActual && <small className="rt-nota">{notaActual}</small>}
                                </td>
                                <td className="rt-acciones">
                                  <button className="btn btn-secundario btn-pequeno" type="button" onClick={() => abrirRevision(t)}>
                                    {clave === 'PENDIENTE' ? 'Agregar nota' : 'Cambiar'}
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    <nav className="rt-paginacion" aria-label="Paginación">
                      <span>
                        {paginacion.total_registros === 0 ? 0 : (paginacion.pagina - 1) * paginacion.por_pagina + 1}–
                        {Math.min(paginacion.pagina * paginacion.por_pagina, paginacion.total_registros)} de {paginacion.total_registros}
                      </span>
                      <div>
                        <button className="btn btn-secundario btn-pequeno" type="button" onClick={() => setPagina(paginacion.pagina - 1)} disabled={paginacion.pagina <= 1}>Anterior</button>
                        <span className="rt-pagina">Página {paginacion.pagina} de {paginacion.total_paginas}</span>
                        <button className="btn btn-secundario btn-pequeno" type="button" onClick={() => setPagina(paginacion.pagina + 1)} disabled={paginacion.pagina >= paginacion.total_paginas}>Siguiente</button>
                      </div>
                    </nav>
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {seleccion && (
        <div className="rt-modal-fondo" role="presentation">
          <form className="rt-modal" role="dialog" aria-modal="true" aria-labelledby="rt-modal-titulo" onSubmit={guardarRevision}>
            <h2 id="rt-modal-titulo">Revisar transacción {idTx(seleccion) != null ? `#${idTx(seleccion)}` : ''}</h2>
            <p className="rt-modal-detalle">
              {formatearHora(seleccion.hora ?? seleccion.fecha)} · {Array.isArray(seleccion.metodos) ? seleccion.metodos.join(', ') : seleccion.metodos} · {formatearMoneda(seleccion.total)}
            </p>

            <fieldset className="rt-opciones">
              <legend>Resultado de la revisión</legend>
              <label className={estadoNuevo === 'REVISADA' ? 'rt-opcion rt-opcion-activa' : 'rt-opcion'}>
                <input type="radio" name="estado" value="REVISADA" checked={estadoNuevo === 'REVISADA'} onChange={() => { setEstadoNuevo('REVISADA'); setErrorModal('') }} />
                Revisada
              </label>
              <label className={estadoNuevo === 'OBSERVADA' ? 'rt-opcion rt-opcion-activa' : 'rt-opcion'}>
                <input type="radio" name="estado" value="OBSERVADA" checked={estadoNuevo === 'OBSERVADA'} onChange={() => { setEstadoNuevo('OBSERVADA'); setErrorModal('') }} />
                Observada
              </label>
            </fieldset>

            <label className="rt-campo">
              Nota {estadoNuevo === 'OBSERVADA' ? '(obligatoria)' : '(opcional)'}
              <textarea
                rows={3}
                value={nota}
                onChange={(e) => { setNota(e.target.value); setErrorModal('') }}
                placeholder={estadoNuevo === 'OBSERVADA' ? 'Explica por qué se observa esta transacción' : 'Agrega un comentario si lo necesitas'}
              />
            </label>

            {errorModal && <p className="rt-error-linea" role="alert">{errorModal}</p>}

            <div className="rt-modal-acciones">
              <button className="btn btn-secundario" type="button" onClick={() => setSeleccion(null)} disabled={guardando}>Cancelar</button>
              <button className="btn" type="submit" disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}
