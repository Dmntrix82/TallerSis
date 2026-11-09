import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import '../App.css'

const BASE_URL = import.meta.env.VITE_GESTION_PAGOS_API_BASE_URL || 'http://localhost:4005'
const CAJA_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4004'
const CAJEROS_URL = `${BASE_URL}/api/pagos/revision/cajeros`
const HISTORIAL_URL = `${BASE_URL}/api/pagos/historial-cajeros`
// TDSI-62/963/964: apertura, cierre y aprobacion de operaciones especiales (gestion_caja),
// para combinar con las ventas/anulaciones de arriba (gestion_pagos) en una sola tabla.
const EVENTOS_URL = `${CAJA_BASE_URL}/api/caja/eventos-autorizacion`
const POR_PAGINA = 10
// Tope de paginas de ventas que se traen para combinar con los eventos de gestion_caja
// (un rango de fechas angosto no debería acercarse a esto; de lo contrario, el filtro
// por cajero o por fechas más corto es la forma de acotar la consulta).
const MAX_PAGINAS_VENTAS = 10

const ETIQUETA_TIPO = {
  APERTURA: 'Apertura',
  CIERRE: 'Cierre',
  OPERACION_ESPECIAL: 'Operación especial',
}
const TIPOS_CON_AUTORIZACION = new Set(['ANULADA', 'APERTURA', 'CIERRE', 'OPERACION_ESPECIAL'])

const aFechaLocal = (fecha) => {
  const offset = fecha.getTimezoneOffset()
  return new Date(fecha.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

const fechaHoy = () => aFechaLocal(new Date())

const hace7Dias = () => {
  const d = new Date()
  d.setDate(d.getDate() - 6)
  return aFechaLocal(d)
}

const formatearMoneda = (valor) =>
  new Intl.NumberFormat('es-BO', {
    style: 'currency',
    currency: 'BOB',
    minimumFractionDigits: 2,
  }).format(Number(valor) || 0)

const SOLO_FECHA = /^\d{4}-\d{2}-\d{2}$/

const aFecha = (valor) => {
  if (!valor) return null
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? null : d
}

const formatearDia = (dia) => {
  if (!SOLO_FECHA.test(dia)) return String(dia || '—')
  const [anio, mes, d] = dia.split('-')
  return `${d}/${mes}/${anio}`
}

const formatearFechaHora = (valor) => {
  if (!valor) return '—'
  if (typeof valor === 'string' && SOLO_FECHA.test(valor)) return formatearDia(valor)
  const d = aFecha(valor)
  if (!d) return String(valor)
  return d.toLocaleString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// TDSI-62/960: etiqueta de color por tipo de operacion autorizada (apertura, cierre,
// anulacion, aprobacion); el resto de los estados de venta sigue como antes.
const claseEstado = (estado) => {
  const v = String(estado).toUpperCase()
  if (!v) return 'ho-estado-neutro'
  if (v === 'APERTURA') return 'ho-estado-ok'
  if (v === 'CIERRE') return 'ho-estado-neutro'
  if (v === 'OPERACION_ESPECIAL') return 'ho-estado-info'
  if (/ANUL|RECHAZ|ERROR|FALL/.test(v)) return 'ho-estado-error'
  if (/PEND/.test(v)) return 'ho-estado-pendiente'
  return 'ho-estado-ok'
}

const etiquetaEstado = (estado) => ETIQUETA_TIPO[estado] || estado

// TDSI-62/961: solo las operaciones que de verdad necesitaron un supervisor (anulacion,
// apertura, cierre, operacion especial) muestran quien autorizo; el resto muestra "—",
// y las de antes de este cambio (sin el dato guardado) muestran "No registrado".
const autorizadoPorMostrar = (op) => {
  if (!TIPOS_CON_AUTORIZACION.has(op.estado)) return '—'
  return op.autorizado_por || 'No registrado'
}

const obtenerMensajeError = (error) => {
  const status = error?.status
  if (status === 400 || status === 422) return error?.message || 'Los filtros enviados no son válidos.'
  if (status === 502 || status === 503) return 'El servicio no está disponible por el momento.'
  if (status) return error?.message || 'No se pudo obtener el historial.'
  return 'No se pudo conectar con el servidor. Verifique su conexión.'
}

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

export default function HistorialOperaciones() {
  const [cajeros, setCajeros] = useState([])
  const [cargandoCajeros, setCargandoCajeros] = useState(true)
  const [errorCajeros, setErrorCajeros] = useState('')
  const [cajeroId, setCajeroId] = useState('')
  const [supervisorId, setSupervisorId] = useState('')
  const [desde, setDesde] = useState(hace7Dias)
  const [hasta, setHasta] = useState(fechaHoy)

  // TDSI-62/963/964: lista combinada de ventas/anulaciones (gestion_pagos) + apertura,
  // cierre y operaciones especiales (gestion_caja), ya ordenada por fecha. La paginacion
  // se hace en el navegador sobre esta lista combinada (ver "visibles" mas abajo).
  const [operaciones, setOperaciones] = useState([])
  const [resumen, setResumen] = useState(null)
  const [avisoEventos, setAvisoEventos] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [orden, setOrden] = useState('desc')
  const [pagina, setPagina] = useState(1)

  const peticion = useRef(0)
  const rangoInvalido = Boolean(desde && hasta && desde > hasta)

  useEffect(() => {
    let activo = true
    ;(async () => {
      if (rangoInvalido) return
      setCargandoCajeros(true)
      try {
        const res = await requestJson(`${CAJEROS_URL}?desde=${desde}&hasta=${hasta}`)
        const datos = res?.data ?? res
        if (activo) setCajeros(Array.isArray(datos) ? datos : datos?.cajeros ?? [])
      } catch (err) {
        if (activo) setErrorCajeros(obtenerMensajeError(err))
      } finally {
        if (activo) setCargandoCajeros(false)
      }
    })()
    return () => { activo = false }
  }, [desde, hasta, rangoInvalido])

  // Trae todas las ventas/anulaciones del rango (paginando por dentro, hasta
  // MAX_PAGINAS_VENTAS), ya que la paginacion final es sobre la lista combinada.
  async function obtenerTodasLasVentas(params) {
    const primera = await requestJson(`${HISTORIAL_URL}?${new URLSearchParams({ ...params, pagina: 1, por_pagina: 100 })}`)
    const datos = primera?.data ?? primera
    let operaciones = datos.operaciones ?? []
    const resumen = datos.resumen ?? null
    const totalPaginas = Math.min(datos.paginacion?.total_paginas ?? 1, MAX_PAGINAS_VENTAS)
    for (let p = 2; p <= totalPaginas; p++) {
      const r = await requestJson(`${HISTORIAL_URL}?${new URLSearchParams({ ...params, pagina: p, por_pagina: 100 })}`)
      operaciones = operaciones.concat((r?.data ?? r).operaciones ?? [])
    }
    return { operaciones, resumen }
  }

  const normalizarVenta = (op) => ({
    key: `VTA-${op.id_transaccion}`,
    fecha: op.fecha,
    metodos: op.metodos,
    total: op.total,
    estado: op.estado,
    pedido_por: op.pedido_por,
    autorizado_por: op.autorizado_por,
  })

  const normalizarEvento = (e, i) => ({
    key: `EVT-${e.tipo}-${e.caja_id}-${e.fecha}-${i}`,
    fecha: e.fecha,
    metodos: e.descripcion || etiquetaEstado(e.tipo),
    total: e.monto,
    estado: e.tipo,
    pedido_por: e.pedido_por,
    autorizado_por: e.autorizado_por,
  })

  const cargarHistorial = useCallback(async () => {
    if (!desde || !hasta || rangoInvalido) {
      setOperaciones([])
      setResumen(null)
      setAvisoEventos('')
      setError('')
      return
    }
    const actual = ++peticion.current
    setCargando(true)
    setError('')
    setAvisoEventos('')
    try {
      const paramsVentas = { desde, hasta }
      if (cajeroId) paramsVentas.cajero_id = cajeroId
      // TDSI-62/959: filtrar por el supervisor que autorizo (anulacion, apertura, cierre u operacion especial).
      const supervisor = supervisorId.trim()
      if (supervisor) paramsVentas.supervisor_id = supervisor

      const paramsEventos = new URLSearchParams({ desde, hasta })
      if (supervisor) paramsEventos.append('supervisor_id', supervisor)

      const [ventasResultado, eventosResultado] = await Promise.allSettled([
        obtenerTodasLasVentas(paramsVentas),
        requestJson(`${EVENTOS_URL}?${paramsEventos}`),
      ])
      if (actual !== peticion.current) return

      if (ventasResultado.status === 'rejected') throw ventasResultado.reason

      const ventas = ventasResultado.value.operaciones.map(normalizarVenta)

      let eventos = []
      if (eventosResultado.status === 'fulfilled') {
        const datosEventos = eventosResultado.value?.data ?? eventosResultado.value
        eventos = (datosEventos.eventos ?? [])
          .filter((e) => !cajeroId || e.pedido_por === cajeroId)
          .map(normalizarEvento)
      } else {
        setAvisoEventos('No se pudo cargar la apertura, el cierre ni la aprobación de operaciones (gestion_caja no respondió). Se muestran solo las ventas.')
      }

      const combinadas = [...ventas, ...eventos].sort((a, b) => new Date(b.fecha) - new Date(a.fecha))

      setOperaciones(combinadas)
      setResumen(ventasResultado.value.resumen)
    } catch (err) {
      if (actual !== peticion.current) return
      setOperaciones([])
      setResumen(null)
      setError(obtenerMensajeError(err))
    } finally {
      if (actual === peticion.current) setCargando(false)
    }
  }, [cajeroId, supervisorId, desde, hasta, rangoInvalido])

  useEffect(() => {
    cargarHistorial()
  }, [cargarHistorial])

  const nombreCajero = (() => {
    const c = cajeros.find((item) => String(item.cajero_id) === String(cajeroId))
    return c?.cajero ?? ''
  })()

  const ordenadas = useMemo(() => {
    return orden === 'asc' ? [...operaciones].reverse() : operaciones
  }, [operaciones, orden])

  // Paginacion sobre la lista ya combinada (ventas + eventos de gestion_caja).
  const totalRegistros = ordenadas.length
  const totalPaginas = Math.max(1, Math.ceil(totalRegistros / POR_PAGINA))
  const paginaActual = Math.min(pagina, totalPaginas)
  const paginacion = { pagina: paginaActual, por_pagina: POR_PAGINA, total_paginas: totalPaginas, total_registros: totalRegistros }
  const visibles = useMemo(
    () => ordenadas.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA),
    [ordenadas, paginaActual]
  )

  const cambiarFiltro = (setter) => (event) => {
    setter(event.target.value)
    setPagina(1)
  }

  const hayFiltros = !rangoInvalido

  return (
    <section className="historial-operaciones">
      <header className="ho-header">
        <div className="ho-icono" aria-hidden="true">≡</div>
        <div>
          <p className="ho-eyebrow">SUPERVISIÓN / CAJA</p>
          <h1>Historial de operaciones</h1>
          <p className="ho-descripcion">Consulta las operaciones de los cajeros en un rango de fechas.</p>
        </div>
      </header>

      <section className="ho-panel" aria-labelledby="ho-filtros-titulo">
        <h2 id="ho-filtros-titulo">Filtros</h2>
        <div className="ho-filtros">
          <label className="ho-campo">
            Cajero
            <select value={cajeroId} onChange={cambiarFiltro(setCajeroId)} disabled={cargandoCajeros}>
              <option value="">{cargandoCajeros ? 'Cargando cajeros...' : 'Todos los cajeros'}</option>
              {cajeros.map((c) => (
                <option key={c.cajero_id} value={c.cajero_id}>{c.cajero}</option>
              ))}
            </select>
          </label>
          <label className="ho-campo">
            Supervisor que autorizó
            <input
              type="text"
              value={supervisorId}
              onChange={cambiarFiltro(setSupervisorId)}
              placeholder="Código del supervisor"
            />
          </label>
          <label className="ho-campo">
            Desde
            <input type="date" value={desde} max={hasta || undefined} onChange={cambiarFiltro(setDesde)} required />
          </label>
          <label className="ho-campo">
            Hasta
            <input type="date" value={hasta} min={desde || undefined} onChange={cambiarFiltro(setHasta)} required />
          </label>
        </div>
        {rangoInvalido && <p className="ho-error-linea" role="alert">La fecha "Desde" no puede ser posterior a "Hasta".</p>}
        {errorCajeros && <p className="ho-error-linea" role="alert">No se pudieron cargar los cajeros: {errorCajeros}</p>}
        {supervisorId.trim() && (
          <p className="ho-error-linea" role="status" style={{ color: 'inherit' }}>
            Solo las operaciones que necesitaron un supervisor (apertura, cierre, anulación o aprobación) tienen autorizante, así que este filtro solo muestra esas.
          </p>
        )}
        {avisoEventos && <p className="ho-error-linea" role="status">{avisoEventos}</p>}
      </section>

      {!hayFiltros && (
        <div className="ho-vacio">
          <strong>Ajusta las fechas</strong>
          <p>Elige un rango de fechas válido para ver el historial.</p>
        </div>
      )}

      {error && (
        <div className="ho-alerta" role="alert">
          <span aria-hidden="true">!</span>
          <div>
            <strong>No se pudo cargar el historial</strong>
            <p>{error}</p>
          </div>
          <button className="btn btn-secundario btn-pequeno" type="button" onClick={cargarHistorial}>Reintentar</button>
        </div>
      )}

      {hayFiltros && cargando && (
        <div aria-live="polite" aria-label="Cargando historial">
          {[1, 2, 3, 4].map((i) => <div className="ho-skeleton" key={i} />)}
        </div>
      )}

      {hayFiltros && !cargando && !error && operaciones.length === 0 && (
        <div className="ho-vacio">
          <strong>Sin historial de operaciones</strong>
          <p>
            No hay operaciones{nombreCajero ? ` de ${nombreCajero}` : ''} entre {formatearDia(desde)} y {formatearDia(hasta)}.
          </p>
        </div>
      )}

      {hayFiltros && !cargando && !error && operaciones.length > 0 && resumen && (
        <>
          {/* Resumen calculado por el backend */}
          <section className="ho-panel" aria-labelledby="ho-resumen-titulo">
            <h2 id="ho-resumen-titulo">Resumen por día</h2>
            <div className="ho-totales">
              <div className="ho-total ho-total-principal">
                <span>Total recaudado</span>
                <strong>{formatearMoneda(resumen.total)}</strong>
              </div>
              <div className="ho-total"><span>Ventas</span><strong>{resumen.cantidad_operaciones}</strong></div>
              <div className="ho-total"><span>Días con actividad</span><strong>{resumen.por_dia?.length || 0}</strong></div>
            </div>
            <div className="ho-tabla-contenedor ho-tabla-resumen">
              <table className="ho-tabla">
                <thead>
                  <tr>
                    <th>Día</th>
                    <th className="ho-derecha">Operaciones</th>
                    <th className="ho-derecha">Total recaudado</th>
                  </tr>
                </thead>
                <tbody>
                  {resumen.por_dia?.map((d) => (
                    <tr key={d.fecha}>
                      <td>{formatearDia(d.fecha)}</td>
                      <td className="ho-derecha">{d.cantidad_operaciones}</td>
                      <td className="ho-derecha ho-monto">{formatearMoneda(d.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="ho-panel" aria-labelledby="ho-tabla-titulo">
            <h2 id="ho-tabla-titulo">Operaciones</h2>
            <div className="ho-tabla-contenedor">
              <table className="ho-tabla">
                <thead>
                  <tr>
                    <th aria-sort={orden === 'asc' ? 'ascending' : 'descending'}>
                      <button
                        className="ho-orden"
                        type="button"
                        onClick={() => {
                          setOrden(orden === 'asc' ? 'desc' : 'asc')
                        }}
                      >
                        Fecha y hora <span aria-hidden="true">{orden === 'asc' ? '↑' : '↓'}</span>
                      </button>
                    </th>
                    <th>Método</th>
                    <th className="ho-derecha">Monto</th>
                    <th>Estado</th>
                    <th>Pedido por</th>
                    <th>Autorizado por</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((op) => (
                    <tr key={op.key}>
                      <td className="ho-fecha">{formatearFechaHora(op.fecha)}</td>
                      <td className="ho-metodo">{Array.isArray(op.metodos) ? op.metodos.join(', ') : op.metodos}</td>
                      <td className="ho-derecha ho-monto">{op.total == null ? '—' : formatearMoneda(op.total)}</td>
                      <td>
                        <span className={`ho-estado ${claseEstado(op.estado)}`}><span aria-hidden="true" />{etiquetaEstado(op.estado)}</span>
                      </td>
                      <td>{op.pedido_por || '—'}</td>
                      <td title={TIPOS_CON_AUTORIZACION.has(op.estado) ? `Autorizado el ${formatearFechaHora(op.fecha)}` : undefined}>
                        {autorizadoPorMostrar(op)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <nav className="ho-paginacion" aria-label="Paginación">
              <span>
                {paginacion.total_registros === 0 ? 0 : (paginacion.pagina - 1) * paginacion.por_pagina + 1}–
                {Math.min(paginacion.pagina * paginacion.por_pagina, paginacion.total_registros)} de {paginacion.total_registros}
              </span>
              <div>
                <button className="btn btn-secundario btn-pequeno" type="button" onClick={() => setPagina(paginacion.pagina - 1)} disabled={paginacion.pagina <= 1}>Anterior</button>
                <span className="ho-pagina">Página {paginacion.pagina} de {paginacion.total_paginas}</span>
                <button className="btn btn-secundario btn-pequeno" type="button" onClick={() => setPagina(paginacion.pagina + 1)} disabled={paginacion.pagina >= paginacion.total_paginas}>Siguiente</button>
              </div>
            </nav>
          </section>
        </>
      )}
    </section>
  )
}
