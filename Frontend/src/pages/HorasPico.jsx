import { useEffect, useState } from 'react'
import { obtenerHorasPico } from '../api/tablero.js'
import { listarCajas } from '../api/caja.js'
import GraficoBarras from '../components/GraficoBarras.jsx'

const HORA_INICIO = 7
const HORA_FIN = 23
const COLOR_NORMAL = '#2a78d6'
const COLOR_PICO = '#eb6834'

function hoyLocal() {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

function etiquetaHora(h) {
  return `${String(h).padStart(2, '0')}:00`
}

// TDSI-192/764-767: pantalla "Horas pico" del Administrador -- ventas por hora del
// dia (07:00 a 23:00) en un rango de fechas, con filtro opcional por caja, y las 3
// horas con mas ventas resaltadas.
function HorasPico() {
  const [cajas, setCajas] = useState([])
  const [desde, setDesde] = useState(hoyLocal)
  const [hasta, setHasta] = useState(hoyLocal)
  const [caja, setCaja] = useState('')

  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    listarCajas()
      .then((r) => setCajas(r.data))
      .catch(() => setCajas([]))
  }, [])

  useEffect(() => {
    if (!desde || !hasta) return
    let vigente = true
    setCargando(true)
    setError(null)
    obtenerHorasPico(desde, hasta, caja)
      .then((r) => vigente && setDatos(r.data))
      .catch((err) => vigente && setError(err.mensaje || err.message))
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [desde, hasta, caja])

  const horasConVentas = new Map((datos?.horas ?? []).map((h) => [h.hora, h]))
  const horasPico = new Set((datos?.top3 ?? []).map((h) => h.hora))

  const items = []
  for (let h = HORA_INICIO; h <= HORA_FIN; h += 1) {
    const dato = horasConVentas.get(h)
    const esPico = horasPico.has(h)
    items.push({
      etiqueta: `${etiquetaHora(h)}${esPico ? ' · Hora pico' : ''}`,
      valor: dato?.cantidad ?? 0,
      color: esPico ? COLOR_PICO : COLOR_NORMAL,
    })
  }

  const hayVentas = (datos?.horas ?? []).length > 0

  return (
    <section>
      <h1>Horas pico</h1>
      <p className="resumen-turno-actual">
        Cantidad de ventas por hora del día (07:00 a 23:00), con las 3 horas de mayor venta resaltadas.
      </p>

      <div className="filtro-fechas">
        <label className="campo">
          Desde
          <input type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label className="campo">
          Hasta
          <input type="date" value={hasta} min={desde || undefined} max={hoyLocal()} onChange={(e) => setHasta(e.target.value)} />
        </label>
        <label className="campo campo-turno-dia">
          Caja
          <select value={caja} onChange={(e) => setCaja(e.target.value)}>
            <option value="">Todas</option>
            {cajas.map((c) => (
              <option key={c.codigo} value={c.codigo}>
                {c.nombre ? `${c.codigo} · ${c.nombre}` : c.codigo}
              </option>
            ))}
          </select>
        </label>
      </div>

      {cargando && <p>Cargando...</p>}
      {!cargando && error && <p className="error">Error: {error}</p>}

      {!cargando && !error && !hayVentas && (
        <p className="orden-mensaje orden-mensaje-pendiente cajas-mensaje">Sin ventas en este rango.</p>
      )}

      {!cargando && !error && hayVentas && (
        <div className="tablero-grafico">
          <GraficoBarras items={items} formatoValor={(v) => `${v} ${v === 1 ? 'venta' : 'ventas'}`} />
        </div>
      )}
    </section>
  )
}

export default HorasPico
