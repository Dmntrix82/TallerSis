import { useEffect, useState } from 'react'
import { obtenerIngresosDia, urlStreamIngresosDia, obtenerRankings, obtenerSerieDiaria } from '../api/tablero.js'
import { obtenerTotalesGenerales } from '../api/pagos.js'
import { listarCajas } from '../api/caja.js'
import GraficoBarras from '../components/GraficoBarras.jsx'
import GraficoArea from '../components/GraficoArea.jsx'
import GraficoPastel from '../components/GraficoPastel.jsx'

// Paleta de datos (no la de marca): estas dos pasan el validador de contraste/CVD
// para uso como color categorico, cosa que el verde/oliva/menta de la marca no logra.
const COLOR_FISICO = '#2a78d6'
const COLOR_VIRTUAL = '#eb6834'
const COLOR_CAJA = '#2a78d6'
const COLOR_CAJERO = '#7c3aed'
const COLOR_EFECTIVO = '#2a9d5c'
const COLOR_TARJETA = '#2a78d6'
const COLOR_QR = '#eb6834'

const formatoBs = (valor) => `Bs. ${valor.toFixed(2)}`

// Íconos simples (línea, mismo estilo que el resto de la app) para las tarjetas del resumen.
const ICONOS = {
  trofeo: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z" />
      <path d="M7 5H4a1 1 0 0 0-1 1v1a4 4 0 0 0 4 4M17 5h3a1 1 0 0 1 1 1v1a4 4 0 0 1-4 4" />
    </svg>
  ),
  efectivo: (
    <svg width="22" height="14" viewBox="0 0 32 20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="1" y="1" width="30" height="18" rx="2" />
      <circle cx="16" cy="10" r="4" />
    </svg>
  ),
  tarjeta: (
    <svg width="22" height="16" viewBox="0 0 32 22" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="1" y="1" width="30" height="20" rx="3" />
      <rect x="1" y="6" width="30" height="4" fill="currentColor" stroke="none" />
    </svg>
  ),
  recibo: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2Z" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  ),
  anulado: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </svg>
  ),
}

function etiquetaCaja(caja_id) {
  return caja_id === 'SIN_CAJA' ? 'Sin caja asignada' : caja_id
}

// Combina la lista real de cajas activas con los totales que sí tienen ventas,
// para que las cajas sin ventas todavía aparezcan (en 0) en vez de desaparecer.
function mezclarConTodasLasCajas(cajasActivas, totales) {
  const mapa = new Map(totales.map((c) => [c.caja_id, c]))
  return cajasActivas.map((c) => {
    const existente = mapa.get(c.codigo)
    return {
      caja_id: c.codigo,
      total: existente?.total ?? 0,
      cantidadVentas: existente?.cantidadVentas ?? existente?.cantidad ?? 0,
    }
  })
}

function StatCard({ icono, color, etiqueta, valor }) {
  return (
    <div className="tablero-stat">
      <div className="tablero-stat-icono" style={{ backgroundColor: color }}>
        {icono}
      </div>
      <div>
        <span className="tablero-stat-etiqueta">{etiqueta}</span>
        <span className="tablero-stat-valor">{valor}</span>
      </div>
    </div>
  )
}

// TDSI-379: tablero consolidado de ingresos (dashboard administrador).
function TableroIngresos() {
  const [fecha, setFecha] = useState('') // '' = hoy (se actualiza en vivo)
  const [hoy, setHoy] = useState(null) // fecha de "hoy" segun el backend
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const [totalHistorico, setTotalHistorico] = useState(null)
  const [errorHistorico, setErrorHistorico] = useState(null)

  const [rankings, setRankings] = useState(null)
  const [errorRankings, setErrorRankings] = useState(null)

  const [cajasActivas, setCajasActivas] = useState([])

  const [serieDiaria, setSerieDiaria] = useState(null)
  const [errorSerie, setErrorSerie] = useState(null)

  const esHoy = !fecha || fecha === hoy

  // TDSI-328: cuanto ha ganado el negocio en total desde el inicio (todas las cajas).
  useEffect(() => {
    obtenerTotalesGenerales()
      .then((r) => setTotalHistorico(r.data))
      .catch((err) => setErrorHistorico(err.message))
  }, [])

  // TDSI-330: que caja/cajero/cliente generan mas.
  useEffect(() => {
    obtenerRankings()
      .then((r) => setRankings(r.data))
      .catch((err) => setErrorRankings(err.message))
  }, [])

  // TDSI-331: lista real de cajas, para mostrar todas (aunque tengan 0 ventas).
  useEffect(() => {
    listarCajas()
      .then((r) => setCajasActivas(r.data))
      .catch(() => setCajasActivas([]))
  }, [])

  // TDSI-331: ventas de los ultimos 14 dias, para el grafico de montañas.
  useEffect(() => {
    obtenerSerieDiaria(14)
      .then((r) => setSerieDiaria(r.data))
      .catch((err) => setErrorSerie(err.message))
  }, [])

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

  const porCajaCompleto = datos && cajasActivas.length > 0 ? mezclarConTodasLasCajas(cajasActivas, datos.porCaja) : datos?.porCaja ?? []
  const rankingCajasCompleto = rankings && cajasActivas.length > 0 ? mezclarConTodasLasCajas(cajasActivas, rankings.cajas) : rankings?.cajas ?? []

  const serieItems = serieDiaria
    ? serieDiaria.map((d) => ({
        etiqueta: new Date(`${d.fecha}T00:00:00`).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit' }),
        valor: d.total,
      }))
    : []

  return (
    <section>
      <h1>Tablero de ingresos</h1>

      {errorHistorico && <p className="error">Error al cargar el total histórico: {errorHistorico}</p>}

      {totalHistorico && (
        <div className="tablero-resumen" style={{ marginBottom: '2rem' }}>
          <StatCard icono={ICONOS.trofeo} color="#345c32" etiqueta="Total histórico ganado" valor={formatoBs(totalHistorico.totalGeneral)} />
          <StatCard icono={ICONOS.efectivo} color={COLOR_FISICO} etiqueta="Efectivo" valor={formatoBs(totalHistorico.totalEfectivo)} />
          <StatCard icono={ICONOS.tarjeta} color={COLOR_VIRTUAL} etiqueta="Digital (Tarjeta + QR)" valor={formatoBs(totalHistorico.totalDigital)} />
          <StatCard icono={ICONOS.recibo} color={COLOR_CAJERO} etiqueta="Ventas totales" valor={totalHistorico.cantidadVentas} />
          <StatCard icono={ICONOS.anulado} color="#b91c1c" etiqueta="Facturas anuladas" valor={totalHistorico.cantidadAnuladas} />
        </div>
      )}

      <div className="tablero-dos-columnas" style={{ marginBottom: '2rem' }}>
        <div className="tablero-grafico" style={{ marginBottom: 0 }}>
          <h2>Ventas de los últimos 14 días</h2>
          {errorSerie && <p className="error">{errorSerie}</p>}
          {serieItems.length > 0 && <GraficoArea items={serieItems} color="#345c32" formatoValor={formatoBs} />}
        </div>

        <div className="tablero-grafico" style={{ marginBottom: 0 }}>
          <h2>Métodos de pago (histórico)</h2>
          {totalHistorico && (
            <GraficoPastel
              items={[
                { etiqueta: 'Efectivo', valor: totalHistorico.totalEfectivo, color: COLOR_EFECTIVO },
                { etiqueta: 'Tarjeta', valor: totalHistorico.totalTarjeta, color: COLOR_TARJETA },
                { etiqueta: 'QR', valor: totalHistorico.totalQR, color: COLOR_QR },
              ]}
              formatoValor={formatoBs}
            />
          )}
        </div>
      </div>

      <h2 style={{ marginTop: 0 }}>Detalle por día</h2>

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
        <div className="tablero-dos-columnas">
          <div>
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
          </div>

          {porCajaCompleto.length > 0 && (
            <div className="tablero-grafico">
              <h2>Total por caja</h2>
              <GraficoBarras
                items={porCajaCompleto.map((c) => ({
                  etiqueta: etiquetaCaja(c.caja_id),
                  valor: c.total,
                  color: COLOR_CAJA,
                }))}
                formatoValor={formatoBs}
              />
            </div>
          )}
        </div>
      )}

      <h2>Rankings</h2>
      {errorRankings && <p className="error">Error al cargar los rankings: {errorRankings}</p>}

      {rankings && (
        <>
          <div className="tablero-dos-columnas">
            {rankingCajasCompleto.length > 0 && (
              <div className="tablero-grafico" style={{ marginBottom: 0 }}>
                <h2>Caja que más genera</h2>
                <GraficoBarras
                  items={rankingCajasCompleto.map((c) => ({ etiqueta: c.caja_id, valor: c.total, color: COLOR_CAJA }))}
                  formatoValor={formatoBs}
                />
              </div>
            )}

            {rankings.cajeros.length > 0 && (
              <div className="tablero-grafico" style={{ marginBottom: 0 }}>
                <h2>Cajero que más ha generado</h2>
                <GraficoBarras
                  items={rankings.cajeros.map((c) => ({ etiqueta: c.cajero, valor: c.total, color: COLOR_CAJERO }))}
                  formatoValor={formatoBs}
                />
              </div>
            )}
          </div>

          {rankings.clientes.length > 0 && (
            <div className="tablero-grafico">
              <h2>Clientes que más han venido</h2>
              <ol className="ranking-clientes">
                {rankings.clientes.map((c) => (
                  <li key={`${c.tipo_documento}-${c.numero}`}>
                    <span className="ranking-clientes-nombre">{c.razon_social || 'Consumidor final'}</span>
                    <span className="ranking-clientes-doc">{c.tipo_documento} {c.numero}</span>
                    <span className="ranking-clientes-veces">{c.cantidadCompras} compras</span>
                    <span className="ranking-clientes-total">{formatoBs(c.totalGastado)}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}
    </section>
  )
}

export default TableroIngresos
