import { useEffect, useState } from 'react'
import { listarCajas, obtenerComparacionMontos } from '../../api/caja.js'

const ETIQUETA_TIPO = {
  CUADRA: 'Cuadra',
  FALTANTE: 'Faltante',
  SOBRANTE: 'Sobrante',
  SIN_ARQUEO: 'Sin arqueo',
}

function hoyLocal() {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

// El turno puede no tener arqueo todavia (SIN_ARQUEO): esos valores vienen null.
const bs = (v) => (v == null ? '—' : v.toFixed(2))

function PanelComparacion() {
  const [fecha, setFecha] = useState(hoyLocal)
  const [filtroCaja, setFiltroCaja] = useState('')
  const [filtroCajero, setFiltroCajero] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')

  const [cajas, setCajas] = useState([])
  const [cajeros, setCajeros] = useState([])
  const [resumen, setResumen] = useState(null)
  const [turnos, setTurnos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [recargar, setRecargar] = useState(0)

  useEffect(() => {
    listarCajas()
      .then((r) => setCajas(r.data))
      .catch(() => setCajas([]))
  }, [])

  useEffect(() => {
    setCajeros([])
    setFiltroCajero('')
  }, [fecha])

  useEffect(() => {
    if (!fecha) return
    let vigente = true
    setCargando(true)
    setError(null)
    obtenerComparacionMontos({ fecha, caja_id: filtroCaja, cajero_id: filtroCajero, tipo: filtroTipo })
      .then((r) => {
        if (!vigente) return
        setResumen(r.data.resumen)
        setTurnos(r.data.turnos)
        setCajeros((prev) => {
          const porId = new Map(prev.map((c) => [c.id, c]))
          r.data.turnos.forEach((t) => {
            if (!porId.has(t.cajero_id)) porId.set(t.cajero_id, { id: t.cajero_id, nombre: t.cajero_nombre || t.cajero_id })
          })
          return [...porId.values()].sort((a, b) => a.nombre.localeCompare(b.nombre))
        })
      })
      .catch((err) => vigente && setError(err.mensaje || err.message))
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [fecha, filtroCaja, filtroCajero, filtroTipo, recargar])

  const hayFiltros = filtroCaja || filtroCajero || filtroTipo

  function quitarFiltros() {
    setFiltroCaja('')
    setFiltroCajero('')
    setFiltroTipo('')
  }

  return (
    <section>
      <h2>Comparación de montos</h2>
      <p className="resumen-turno-actual">
        Monto registrado por el sistema contra el efectivo disponible en caja, por turno.
      </p>

      <div className="filtro-fechas">
        <label className="campo">
          Fecha
          <input type="date" value={fecha} max={hoyLocal()} onChange={(e) => setFecha(e.target.value)} />
        </label>
        <label className="campo">
          Caja
          <select value={filtroCaja} onChange={(e) => setFiltroCaja(e.target.value)}>
            <option value="">Todas</option>
            {cajas.map((c) => (
              <option key={c.codigo} value={c.codigo}>
                {c.nombre ? `${c.codigo} · ${c.nombre}` : c.codigo}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          Cajero
          <select value={filtroCajero} onChange={(e) => setFiltroCajero(e.target.value)}>
            <option value="">Todos</option>
            {cajeros.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </label>
        <label className="campo">
          Diferencia
          <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
            <option value="">Todas</option>
            <option value="CUADRA">Cuadra</option>
            <option value="FALTANTE">Faltante</option>
            <option value="SOBRANTE">Sobrante</option>
          </select>
        </label>
        {hayFiltros && (
          <button type="button" className="btn btn-secundario" onClick={quitarFiltros}>
            Quitar filtros
          </button>
        )}
      </div>

      {cargando && <p>Cargando...</p>}

      {!cargando && error && (
        <div className="orden-mensaje orden-mensaje-error cajas-mensaje">
          <span>No se pudo obtener la comparación: {error}</span>
          <button type="button" className="btn btn-secundario" onClick={() => setRecargar((n) => n + 1)}>
            Reintentar
          </button>
        </div>
      )}

      {!cargando && !error && resumen && (
        <div className="resumen-cards">
          <div className="resumen-card">
            <span className="resumen-card-metodo">Turnos</span>
            <span className="resumen-card-total">{resumen.total}</span>
          </div>
          <div className="resumen-card comparacion-resumen--cuadra">
            <span className="resumen-card-metodo">Cuadran</span>
            <span className="resumen-card-total">{resumen.cuadran}</span>
          </div>
          <div className="resumen-card comparacion-resumen--faltante">
            <span className="resumen-card-metodo">Faltantes</span>
            <span className="resumen-card-total">{resumen.faltantes}</span>
          </div>
          <div className="resumen-card comparacion-resumen--sobrante">
            <span className="resumen-card-metodo">Sobrantes</span>
            <span className="resumen-card-total">{resumen.sobrantes}</span>
          </div>
        </div>
      )}

      {!cargando && !error && turnos.length === 0 && (
        <p className="orden-mensaje orden-mensaje-pendiente cajas-mensaje">
          {hayFiltros
            ? 'No hay turnos que coincidan con los filtros en esta fecha.'
            : 'No hubo turnos en esta fecha.'}
        </p>
      )}

      {!cargando && !error && turnos.length > 0 && (
        <table className="tabla-facturas">
          <thead>
            <tr>
              <th>Turno</th>
              <th>Caja</th>
              <th>Cajero</th>
              <th>Registrado (Bs.)</th>
              <th>Disponible (Bs.)</th>
              <th>Diferencia (Bs.)</th>
              <th>Resultado</th>
            </tr>
          </thead>
          <tbody>
            {turnos.map((t) => {
              const tipoRaw = t.tipo_diferencia || 'CUADRA'; // Si viene nulo, asume cuadra
              const tipo = tipoRaw.toLowerCase();
              return (
                <tr key={t.turno_id} className={`comparacion-fila comparacion-fila--${tipo}`}>
                  <td>
                    {t.codigo}
                    <span className="comparacion-detalle">{t.estado === 'ABIERTO' ? 'Abierto' : 'Cerrado'}</span>
                  </td>
                  <td>{t.caja_id}</td>
                  <td>{t.cajero_nombre || t.cajero_id}</td>
                  <td>{bs(t.efectivo_esperado)}</td>
                  <td>{bs(t.efectivo_contado)}</td>
                  <td className={`comparacion-diferencia--${tipo}`}>
                    {t.diferencia > 0 ? '+' : ''}
                    {bs(t.diferencia)}
                  </td>
                  <td>
                    <span className={`badge-estado badge-comparacion--${tipo}`}>
                      {ETIQUETA_TIPO[tipoRaw] ?? tipoRaw}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </section>
  )
}

export default PanelComparacion
