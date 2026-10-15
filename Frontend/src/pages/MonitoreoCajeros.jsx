import { useCallback, useEffect, useRef, useState } from 'react'
import '../App.css'

const BASE_URL = import.meta.env.VITE_GESTION_PAGOS_API_BASE_URL || 'http://localhost:4005'
const MONITOREO_URL = `${BASE_URL}/api/pagos/monitoreo`
const INTERVALO_MS = 10_000
const MAX_OPERACIONES = 5

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
  if (status === 502) return 'El servicio de monitoreo no está disponible.'
  if (status === 503) return 'El servicio de monitoreo no está disponible por el momento.'
  if (status) return error?.message || 'No se pudo obtener la información de los cajeros.'
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
  } catch {
    // respuesta sin cuerpo JSON
  }

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

export default function MonitoreoCajeros() {
  const [cajeros, setCajeros] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [actualizado, setActualizado] = useState(null)
  const enCurso = useRef(false)

  const cargar = useCallback(async ({ silencioso = false } = {}) => {
    if (enCurso.current) return
    enCurso.current = true
    if (!silencioso) setCargando(true)
    try {
      const res = await requestJson(MONITOREO_URL)
      const datos = res?.data ?? res
      const lista = Array.isArray(datos) ? datos : datos?.cajeros ?? []
      setCajeros(lista)
      setError('')
      setActualizado(new Date())
    } catch (err) {
      setError(obtenerMensajeError(err))
    } finally {
      enCurso.current = false
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar()
    const temporizador = setInterval(() => cargar({ silencioso: true }), INTERVALO_MS)
    return () => clearInterval(temporizador)
  }, [cargar])

  return (
    <section className="monitoreo-cajeros">
      <header className="mc-header">
        <div className="mc-icono" aria-hidden="true">◎</div>
        <div className="mc-header-texto">
          <p className="mc-eyebrow">SUPERVISIÓN DE CAJA</p>
          <h1>Monitoreo de cajeros</h1>
          <p className="mc-descripcion">Actividad en tiempo real de cada punto de venta activo.</p>
        </div>
        <div className="mc-vivo" aria-live="polite">
          <span className={`mc-vivo-punto ${error ? 'mc-vivo-punto-error' : ''}`} aria-hidden="true" />
          <div>
            <strong>{error ? 'Sin conexión' : 'En vivo'}</strong>
            <small>
              {actualizado ? `Actualizado ${formatearHora(actualizado)}` : 'Esperando datos...'} · cada {INTERVALO_MS / 1000} s
            </small>
          </div>
        </div>
      </header>

      {/* Alerta de error de conexión */}
      {error && (
        <div className="mc-alerta" role="alert">
          <span className="mc-alerta-icono" aria-hidden="true">!</span>
          <div>
            <strong>{error}</strong>
            <p>
              {cajeros.length > 0
                ? 'Se muestran los últimos datos recibidos. Se reintentará automáticamente.'
                : 'Se reintentará automáticamente.'}
            </p>
          </div>
          <button className="btn btn-secundario" type="button" onClick={() => cargar()}>Reintentar</button>
        </div>
      )}

      {cargando && cajeros.length === 0 && (
        <div className="mc-grid" aria-live="polite" aria-label="Cargando cajeros">
          {[1, 2, 3].map((item) => <div className="mc-skeleton" key={item} />)}
        </div>
      )}

      {!cargando && !error && cajeros.length === 0 && (
        <div className="mc-vacio">
          <strong>No hay cajeros activos</strong>
          <p>Cuando un cajero registre operaciones, aparecerá aquí.</p>
        </div>
      )}

      {cajeros.length > 0 && (
        <div className="mc-grid">
          {cajeros.map((cajero, indice) => {
            const operaciones = cajero.operaciones ?? cajero.ultimas_operaciones ?? []
            const cantidad = cajero.cantidad_operaciones ?? cajero.cantidad ?? operaciones.length
            const total =
              cajero.total_acumulado ??
              cajero.total ??
              operaciones.reduce((suma, op) => suma + (Number(op.monto) || 0), 0)
            
            const ultima = cajero.ultima_operacion?.hora ?? operaciones[0]?.hora
            
            const nombre = cajero.cajero ?? cajero.nombre ?? `Cajero ${cajero.id ?? cajero.cajero_id ?? indice + 1}`

            return (
              <article className="mc-card" key={cajero.id ?? cajero.cajero_id ?? indice}>
                <header className="mc-card-header">
                  <span className="mc-avatar" aria-hidden="true">{String(nombre).charAt(0).toUpperCase()}</span>
                  <div>
                    <h2>{nombre}</h2>
                    <small>Última operación: {ultima ? formatearHora(ultima) : '—'}</small>
                  </div>
                </header>

                <div className="mc-metricas">
                  <div><span>Operaciones</span><strong>{cantidad}</strong></div>
                  <div><span>Total cobrado</span><strong>{formatearMoneda(total)}</strong></div>
                </div>

                <div className="mc-operaciones">
                  <h3>Últimas operaciones</h3>
                  {operaciones.length === 0 ? (
                    <p className="mc-sin-operaciones">Sin operaciones registradas</p>
                  ) : (
                    <ul>
                      {operaciones.slice(0, MAX_OPERACIONES).map((op, i) => {
                        
                        const textoMetodos = Array.isArray(op.metodos)
                          ? op.metodos.join(', ') 
                          : (op.metodo ?? op.metodo_pago ?? '—')

                        return (
                          <li key={op.id_transaccion ?? op.id ?? i}>
                            <span className="mc-op-hora">{formatearHora(op.hora ?? op.fecha ?? op.created_at)}</span>
                            <span className="mc-op-metodo">{textoMetodos}</span>
                            <strong className="mc-op-monto">{formatearMoneda(op.monto)}</strong>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}