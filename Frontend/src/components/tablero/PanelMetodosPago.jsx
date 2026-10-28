import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import '../../App.css'

const BASE_URL = import.meta.env.VITE_GESTION_PAGOS_API_BASE_URL || 'http://localhost:4005'
const CAJEROS_URL = `${BASE_URL}/api/pagos/revision/cajeros`
const METODOS_URL = `${BASE_URL}/api/pagos/metodos`

const COLORES = ['#2f5d31', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6', '#ec4899']

const aFechaLocal = (fecha) => {
  const offset = fecha.getTimezoneOffset()
  return new Date(fecha.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

const fechaHoy = () => aFechaLocal(new Date())

const hace30Dias = () => {
  const d = new Date()
  d.setDate(d.getDate() - 29)
  return aFechaLocal(d)
}

const formatearMoneda = (valor) =>
  new Intl.NumberFormat('es-BO', {
    style: 'currency',
    currency: 'BOB',
    minimumFractionDigits: 2,
  }).format(Number(valor) || 0)

const formatearDia = (dia) => {
  const [anio, mes, d] = String(dia).split('-')
  return anio && mes && d ? `${d}/${mes}/${anio}` : String(dia)
}

const formatearPorcentaje = (valor) => `${valor.toFixed(1)}%`

// Reparte porcentajes con 1 decimal garantizando que sumen exactamente 100.0 (método del mayor resto)
const repartirPorcentajes = (valores) => {
  const total = valores.reduce((a, b) => a + b, 0)
  if (total <= 0) return valores.map(() => 0)
  const brutos = valores.map((v) => (v / total) * 1000)
  const base = brutos.map(Math.floor)
  const resto = 1000 - base.reduce((a, b) => a + b, 0)
  const orden = brutos.map((b, i) => ({ i, frac: b - Math.floor(b) })).sort((a, b) => b.frac - a.frac)
  for (let k = 0; k < resto; k += 1) base[orden[k].i] += 1
  return base.map((v) => v / 10)
}

const obtenerMensajeError = (error) => {
  const status = error?.status
  if (status === 400 || status === 422) return error?.message || 'Los filtros enviados no son válidos.'
  if (status === 502 || status === 503) return 'El servicio no está disponible por el momento.'
  if (status) return error?.message || 'No se pudo obtener la información de los métodos de pago.'
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

const RADIO = 70
const CIRCUNFERENCIA = 2 * Math.PI * RADIO

function Donut({ segmentos, activo, setActivo, centroTitulo, centroValor }) {
  let acumulado = 0
  return (
    <svg className="mp-donut" viewBox="0 0 200 200" role="group" aria-label="Participación por método de pago">
      <circle cx="100" cy="100" r={RADIO} fill="none" stroke="#eef1f6" strokeWidth="26" />
      {segmentos.map((s, i) => {
        const largo = (s.porcentaje / 100) * CIRCUNFERENCIA
        const desplazamiento = -acumulado
        acumulado += largo
        const atenuado = activo != null && activo !== i
        return (
          <circle
            key={s.metodo}
            className="mp-donut-segmento"
            cx="100"
            cy="100"
            r={RADIO}
            fill="none"
            stroke={COLORES[i % COLORES.length]}
            strokeWidth={activo === i ? 30 : 26}
            strokeDasharray={`${largo} ${CIRCUNFERENCIA - largo}`}
            strokeDashoffset={desplazamiento}
            transform="rotate(-90 100 100)"
            opacity={atenuado ? 0.3 : 1}
            tabIndex={0}
            aria-label={`${s.metodo}: ${formatearPorcentaje(s.porcentaje)}`}
            onMouseEnter={() => setActivo(i)}
            onMouseLeave={() => setActivo(null)}
            onFocus={() => setActivo(i)}
            onBlur={() => setActivo(null)}
          />
        )
      })}
      <text x="100" y="94" textAnchor="middle" className="mp-donut-titulo">{centroTitulo}</text>
      <text x="100" y="116" textAnchor="middle" className="mp-donut-valor">{centroValor}</text>
    </svg>
  )
}

export default function PanelMetodosPago() {
  const [cajeros, setCajeros] = useState([])
  const [errorCajeros, setErrorCajeros] = useState('')

  const [desde, setDesde] = useState(hace30Dias)
  const [hasta, setHasta] = useState(fechaHoy)
  const [cajeroId, setCajeroId] = useState('')
  const [cajaId, setCajaId] = useState('') // Agregado para cumplir TDSI-623
  const [criterio, setCriterio] = useState('monto')

  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [activo, setActivo] = useState(null)

  const peticion = useRef(0)
  const rangoInvalido = Boolean(desde && hasta && desde > hasta)

  useEffect(() => {
    let activa = true
    ;(async () => {
      if (rangoInvalido) return
      try {
        const res = await requestJson(`${CAJEROS_URL}?desde=${desde}&hasta=${hasta}`)
        const lista = res?.data ?? res
        if (activa) setCajeros(Array.isArray(lista) ? lista : lista?.cajeros ?? [])
      } catch (err) {
        if (activa) setErrorCajeros(obtenerMensajeError(err))
      }
    })()
    return () => { activa = false }
  }, [desde, hasta, rangoInvalido])

  const cargar = useCallback(async () => {
    if (!desde || !hasta || rangoInvalido) {
      setDatos([])
      setError('')
      return
    }
    const actual = ++peticion.current
    setCargando(true)
    setError('')
    try {
      const params = new URLSearchParams({ desde, hasta })
      if (cajeroId) params.set('cajero_id', cajeroId)
      if (cajaId) params.set('caja_id', cajaId) // Enviando la caja al backend

      const res = await requestJson(`${METODOS_URL}?${params}`)
      if (actual !== peticion.current) return
      const lista = res?.data ?? res
      setDatos(Array.isArray(lista) ? lista : lista?.metodos ?? [])
    } catch (err) {
      if (actual !== peticion.current) return
      setDatos([])
      setError(obtenerMensajeError(err))
    } finally {
      if (actual === peticion.current) setCargando(false)
    }
  }, [desde, hasta, cajeroId, cajaId, rangoInvalido])

  useEffect(() => {
    cargar()
  }, [cargar])

  const { filas, totalCantidad, totalMonto } = useMemo(() => {
    const normalizados = datos
      .map((d) => ({
        metodo: d.metodo ?? d.metodo_pago ?? 'Sin especificar',
        cantidad: Number(d.cantidad ?? d.cantidad_operaciones ?? d.total_operaciones) || 0,
        monto: Number(d.monto ?? d.total ?? d.total_monto) || 0,
      }))
      .filter((d) => d.cantidad > 0 || d.monto > 0)
      .sort((a, b) => b[criterio] - a[criterio])

    const porcentajes = repartirPorcentajes(normalizados.map((d) => d[criterio]))
    return {
      filas: normalizados.map((d, i) => ({ ...d, porcentaje: porcentajes[i] })),
      totalCantidad: normalizados.reduce((s, d) => s + d.cantidad, 0),
      totalMonto: normalizados.reduce((s, d) => s + d.monto, 0),
    }
  }, [datos, criterio])

  const filaActiva = activo != null ? filas[activo] : null
  const hayDatos = !cargando && !error && !rangoInvalido && filas.length > 0
  const sinDatos = !cargando && !error && !rangoInvalido && filas.length === 0

  return (
    <section className="metodos-pago">
      <header className="mp-header">
        <div className="mp-icono" aria-hidden="true">◔</div>
        <div>
          <p className="mp-eyebrow">SUPERVISIÓN / CAJA</p>
          <h2>Métodos de pago utilizados</h2>
          <p className="mp-descripcion">Distribución de las operaciones por efectivo, QR, tarjeta y otros medios.</p>
        </div>
      </header>

      <section className="mp-panel" aria-labelledby="mp-filtros-titulo">
        <h2 id="mp-filtros-titulo">Filtros</h2>
        <div className="mp-filtros">
          <label className="mp-campo">
            Desde
            <input type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} required />
          </label>
          <label className="mp-campo">
            Hasta
            <input type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} required />
          </label>
          <label className="mp-campo">
            Cajero
            <select value={cajeroId} onChange={(e) => setCajeroId(e.target.value)}>
              <option value="">Todos los cajeros</option>
              {cajeros.map((c) => (
                <option key={c.cajero_id} value={c.cajero_id}>{c.cajero}</option>
              ))}
            </select>
          </label>
          <label className="mp-campo">
            Caja
            <input type="text" placeholder="Ej: CAJA-01" value={cajaId} onChange={(e) => setCajaId(e.target.value)} />
          </label>
          <div className="mp-campo">
            Participación según
            <div className="mp-segmentado" role="group" aria-label="Criterio de participación">
              <button type="button" className={criterio === 'monto' ? 'mp-seg-activo' : ''} onClick={() => setCriterio('monto')} aria-pressed={criterio === 'monto'}>Monto</button>
              <button type="button" className={criterio === 'cantidad' ? 'mp-seg-activo' : ''} onClick={() => setCriterio('cantidad')} aria-pressed={criterio === 'cantidad'}>Cantidad</button>
            </div>
          </div>
        </div>
        {rangoInvalido && <p className="mp-error-linea" role="alert">La fecha "Desde" no puede ser posterior a "Hasta".</p>}
        {errorCajeros && <p className="mp-error-linea" role="alert">No se pudo cargar la lista de cajeros: {errorCajeros}</p>}
      </section>

      {error && (
        <div className="mp-alerta" role="alert">
          <span aria-hidden="true">!</span>
          <div>
            <strong>No se pudo cargar la información</strong>
            <p>{error}</p>
          </div>
          <button className="btn btn-secundario btn-pequeno" type="button" onClick={cargar}>Reintentar</button>
        </div>
      )}

      {cargando && (
        <div className="mp-grid" aria-live="polite" aria-label="Cargando métodos de pago">
          <div className="mp-skeleton mp-skeleton-alto" />
          <div className="mp-skeleton mp-skeleton-alto" />
        </div>
      )}

      {sinDatos && (
        <div className="mp-vacio">
          <strong>Sin datos de métodos de pago</strong>
          <p>
            No hay operaciones entre {formatearDia(desde)} y {formatearDia(hasta)}
            {cajeroId ? ' para el cajero seleccionado' : ''}. Prueba con otro rango de fechas.
          </p>
        </div>
      )}

      {hayDatos && (
        <div className="mp-grid">
          <section className="mp-panel" aria-labelledby="mp-grafico-titulo">
            <h2 id="mp-grafico-titulo">Participación por método</h2>
            <Donut
              segmentos={filas}
              activo={activo}
              setActivo={setActivo}
              centroTitulo={filaActiva ? filaActiva.metodo : 'Total'}
              centroValor={
                filaActiva
                  ? formatearPorcentaje(filaActiva.porcentaje)
                  : criterio === 'monto' ? formatearMoneda(totalMonto) : `${totalCantidad} ops.`
              }
            />
            <ul className="mp-leyenda">
              {filas.map((f, i) => (
                <li
                  key={f.metodo}
                  className={activo === i ? 'mp-leyenda-activa' : ''}
                  onMouseEnter={() => setActivo(i)}
                  onMouseLeave={() => setActivo(null)}
                >
                  <span className="mp-punto" style={{ background: COLORES[i % COLORES.length] }} aria-hidden="true" />
                  <span className="mp-leyenda-nombre">{f.metodo}</span>
                  <strong>{formatearPorcentaje(f.porcentaje)}</strong>
                </li>
              ))}
            </ul>
          </section>

          <section className="mp-panel" aria-labelledby="mp-tabla-titulo">
            <h2 id="mp-tabla-titulo">Detalle por método</h2>
            <div className="mp-tabla-contenedor">
              <table className="mp-tabla">
                <thead>
                  <tr>
                    <th>Método</th>
                    <th className="mp-derecha">Operaciones</th>
                    <th className="mp-derecha">Monto</th>
                    <th className="mp-derecha">% {criterio === 'monto' ? 'monto' : 'cantidad'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f, i) => (
                    <tr
                      key={f.metodo}
                      className={activo === i ? 'mp-fila-activa' : ''}
                      onMouseEnter={() => setActivo(i)}
                      onMouseLeave={() => setActivo(null)}
                    >
                      <td>
                        <span className="mp-punto" style={{ background: COLORES[i % COLORES.length] }} aria-hidden="true" />
                        <span className="mp-metodo">{f.metodo}</span>
                      </td>
                      <td className="mp-derecha">{f.cantidad}</td>
                      <td className="mp-derecha">{formatearMoneda(f.monto)}</td>
                      <td className="mp-derecha mp-porcentaje">{formatearPorcentaje(f.porcentaje)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total</td>
                    <td className="mp-derecha">{totalCantidad}</td>
                    <td className="mp-derecha">{formatearMoneda(totalMonto)}</td>
                    <td className="mp-derecha">{formatearPorcentaje(filas.reduce((s, f) => s + f.porcentaje, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
