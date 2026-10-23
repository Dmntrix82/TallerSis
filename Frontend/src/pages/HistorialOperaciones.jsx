import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import '../App.css'

const BASE_URL = import.meta.env.VITE_GESTION_PAGOS_API_BASE_URL || 'http://localhost:4005'
const CAJEROS_URL = `${BASE_URL}/api/pagos/revision/cajeros`
const HISTORIAL_URL = `${BASE_URL}/api/pagos/historial-cajeros`
const POR_PAGINA = 10

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

const claseEstado = (estado) => {
  const v = String(estado).toUpperCase()
  if (!v) return 'ho-estado-neutro'
  if (/ANUL|RECHAZ|ERROR|FALL/.test(v)) return 'ho-estado-error'
  if (/PEND/.test(v)) return 'ho-estado-pendiente'
  return 'ho-estado-ok'
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
  const [desde, setDesde] = useState(hace7Dias)
  const [hasta, setHasta] = useState(fechaHoy)

  const [operaciones, setOperaciones] = useState([])
  const [resumen, setResumen] = useState(null)
  const [paginacion, setPaginacion] = useState({ pagina: 1, total_paginas: 1, total_registros: 0 })
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

  const cargarHistorial = useCallback(async () => {
    if (!desde || !hasta || rangoInvalido) {
      setOperaciones([])
      setResumen(null)
      setError('')
      return
    }
    const actual = ++peticion.current
    setCargando(true)
    setError('')
    try {
      const params = new URLSearchParams({ desde, hasta, pagina, por_pagina: POR_PAGINA })
      if (cajeroId) params.append('cajero_id', cajeroId)
      
      const res = await requestJson(`${HISTORIAL_URL}?${params}`)
      if (actual !== peticion.current) return
      
      const datos = res?.data ?? res
      setOperaciones(datos.operaciones ?? [])
      setResumen(datos.resumen ?? null)
      setPaginacion(datos.paginacion ?? { pagina: 1, total_paginas: 1, total_registros: 0 })
    } catch (err) {
      if (actual !== peticion.current) return
      setOperaciones([])
      setResumen(null)
      setError(obtenerMensajeError(err))
    } finally {
      if (actual === peticion.current) setCargando(false)
    }
  }, [cajeroId, desde, hasta, pagina, rangoInvalido])

  useEffect(() => {
    cargarHistorial()
  }, [cargarHistorial])

  const nombreCajero = (() => {
    const c = cajeros.find((item) => String(item.cajero_id) === String(cajeroId))
    return c?.cajero ?? ''
  })()

  const visibles = useMemo(() => {
    return orden === 'asc' ? [...operaciones].reverse() : operaciones
  }, [operaciones, orden])

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
              <div className="ho-total"><span>Operaciones</span><strong>{resumen.cantidad_operaciones}</strong></div>
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
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((op) => (
                    <tr key={op.id_transaccion}>
                      <td className="ho-fecha">{formatearFechaHora(op.fecha)}</td>
                      <td className="ho-metodo">{Array.isArray(op.metodos) ? op.metodos.join(', ') : op.metodos}</td>
                      <td className="ho-derecha ho-monto">{formatearMoneda(op.total)}</td>
                      <td>
                        <span className={`ho-estado ${claseEstado(op.estado)}`}><span aria-hidden="true" />{op.estado}</span>
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