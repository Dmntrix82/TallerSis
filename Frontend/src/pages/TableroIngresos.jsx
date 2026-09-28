import { useEffect, useState } from 'react'
import { obtenerIngresosDia, urlStreamIngresosDia } from '../api/tablero.js'
import GraficoBarras from '../components/GraficoBarras.jsx'

// Paleta de datos (no la de marca): estas dos pasan el validador de contraste/CVD
// para uso como color categorico, cosa que el verde/oliva/menta de la marca no logra.
const COLOR_FISICO = '#2a78d6'
const COLOR_VIRTUAL = '#eb6834'
const COLOR_CAJA = '#2a78d6'

const formatoBs = (valor) => `Bs. ${valor.toFixed(2)}`

function etiquetaCaja(caja_id) {
  return caja_id === 'SIN_CAJA' ? 'Sin caja asignada' : caja_id
}

// TDSI-379: tablero consolidado de ingresos (dashboard administrador).
function TableroIngresos() {
  const [fecha, setFecha] = useState('') // '' = hoy (se actualiza en vivo)
  const [hoy, setHoy] = useState(null) // fecha de "hoy" segun el backend
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const esHoy = !fecha || fecha === hoy

  // TDSI-378: mientras se ve "hoy", el tablero se actualiza solo via Server-Sent Events.
  useEffect(() => {
    if (!esHoy) return

    setCargando(true)
    setError(null)
    const stream = new EventSource(urlStreamIngresosDia())

    stream.onmessage = (event) => {
      const data = JSON.parse(event.data)
      setDatos(data)
      setHoy((prev) => prev ?? data.fecha)
      setCargando(false)
    }
    stream.onerror = () => {
      setError('No se pudo conectar al tablero en tiempo real.')
      setCargando(false)
    }

    return () => stream.close()
  }, [esHoy])

  // TDSI-381: una fecha pasada es una foto fija, no necesita conexion en vivo.
  useEffect(() => {
    if (esHoy) return

    setCargando(true)
    setError(null)
    obtenerIngresosDia(fecha)
      .then((r) => setDatos(r.data))
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false))
  }, [fecha, esHoy])

  const sinDatos = datos && datos.total_general === 0

  return (
    <section>
      <h1>Tablero de ingresos</h1>

      <div className="tablero-filtros">
        {/* TDSI-381: filtro por fecha */}
        <label className="campo">
          Fecha
          <input
            type="date"
            value={fecha || hoy || ''}
            max={hoy || undefined}
            onChange={(e) => setFecha(e.target.value)}
          />
        </label>

        {/* Solo existe una sucursal por ahora (ver tableroService.js), asi que se muestra
            como dato informativo en vez de un selector que no tendria nada mas que elegir. */}
        {datos && <span className="tablero-sucursal">Sucursal: {datos.sucursal}</span>}

        {esHoy && !error && <span className="tablero-en-vivo">En vivo</span>}
      </div>

      {cargando && <p>Cargando...</p>}
      {error && <p className="error">Error: {error}</p>}

      {/* TDSI-382 */}
      {datos && sinDatos && <p>No hay ingresos registrados para el {datos.fecha}.</p>}

      {datos && !sinDatos && (
        <>
          <div className="tablero-resumen">
            <div className="tablero-stat">
              <span className="tablero-stat-etiqueta">Total del día</span>
              <span className="tablero-stat-valor">{formatoBs(datos.total_general)}</span>
            </div>
            <div className="tablero-stat">
              <span className="tablero-stat-etiqueta">Físico ({datos.fisico.cantidad})</span>
              <span className="tablero-stat-valor">{formatoBs(datos.fisico.total)}</span>
            </div>
            <div className="tablero-stat">
              <span className="tablero-stat-etiqueta">Virtual ({datos.virtual.cantidad})</span>
              <span className="tablero-stat-valor">{formatoBs(datos.virtual.total)}</span>
            </div>
          </div>

          {/* TDSI-380 */}
          <div className="tablero-grafico">
            <h2>Ingresos físicos vs virtuales</h2>
            <GraficoBarras
              items={[
                { etiqueta: 'Físico', valor: datos.fisico.total, color: COLOR_FISICO },
                { etiqueta: 'Virtual', valor: datos.virtual.total, color: COLOR_VIRTUAL },
              ]}
              formatoValor={formatoBs}
            />
          </div>

          {datos.porCaja.length > 0 && (
            <div className="tablero-grafico">
              <h2>Total por caja</h2>
              <GraficoBarras
                items={datos.porCaja.map((c) => ({
                  etiqueta: etiquetaCaja(c.caja_id),
                  valor: c.total,
                  color: COLOR_CAJA,
                }))}
                formatoValor={formatoBs}
              />
            </div>
          )}
        </>
      )}
    </section>
  )
}

export default TableroIngresos
