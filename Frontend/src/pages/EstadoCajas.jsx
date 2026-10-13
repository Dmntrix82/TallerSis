import { useEffect, useState } from 'react'
import { obtenerEstadoCajas } from '../api/caja.js'

// TDSI-126: vista del administrador con el estado de cada caja (terminal).
// TDSI-495: una tarjeta por caja.
// TDSI-496: insignias de estado (Abierta/Cerrada y Activa/Inactiva) con colores.
// TDSI-497: filtros por estado operativo y por actividad.
// TDSI-498: mensajes de "sin cajas" y de error.
//
// Datos: GET /api/caja/estado (gestion_caja). Cada caja trae { codigo, nombre, estado, activa },
// donde estado es ABIERTA | CERRADA | INACTIVA. Se piden todas una sola vez y los filtros
// se aplican aqui, porque una caja inactiva tambien cuenta como cerrada para el filtro.

const OPCIONES_ESTADO = [
  { valor: '', etiqueta: 'Todas' },
  { valor: 'ABIERTA', etiqueta: 'Abiertas' },
  { valor: 'CERRADA', etiqueta: 'Cerradas' },
]

const OPCIONES_ACTIVIDAD = [
  { valor: '', etiqueta: 'Todas' },
  { valor: 'ACTIVA', etiqueta: 'Activas' },
  { valor: 'INACTIVA', etiqueta: 'Inactivas' },
]

function EstadoCajas() {
  const [cajas, setCajas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroActividad, setFiltroActividad] = useState('')
  const [recargar, setRecargar] = useState(0)

  useEffect(() => {
    setCargando(true)
    setError(null)
    obtenerEstadoCajas()
      .then((r) => setCajas(r.data))
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false))
  }, [recargar])

  const hayFiltros = filtroEstado || filtroActividad
  const cajasFiltradas = cajas.filter((c) => {
    const abierta = c.estado === 'ABIERTA'
    if (filtroEstado === 'ABIERTA' && !abierta) return false
    if (filtroEstado === 'CERRADA' && abierta) return false
    if (filtroActividad === 'ACTIVA' && !c.activa) return false
    if (filtroActividad === 'INACTIVA' && c.activa) return false
    return true
  })

  return (
    <section>
      <h1>Estado de cajas</h1>
      <p className="resumen-turno-actual">
        Cajas registradas en la sucursal: si tienen un turno abierto ahora mismo y si están habilitadas.
      </p>

      <div className="filtro-fechas">
        <label className="campo campo-turno-dia">
          Estado
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
            {OPCIONES_ESTADO.map((o) => (
              <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
            ))}
          </select>
        </label>
        <label className="campo campo-turno-dia">
          Actividad
          <select value={filtroActividad} onChange={(e) => setFiltroActividad(e.target.value)}>
            {OPCIONES_ACTIVIDAD.map((o) => (
              <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
            ))}
          </select>
        </label>
        {hayFiltros && (
          <button
            type="button"
            className="btn btn-secundario"
            onClick={() => {
              setFiltroEstado('')
              setFiltroActividad('')
            }}
          >
            Quitar filtros
          </button>
        )}
      </div>

      {cargando && <p>Cargando...</p>}

      {!cargando && error && (
        <div className="orden-mensaje orden-mensaje-error cajas-mensaje">
          <span>No se pudo obtener el estado de las cajas: {error}</span>
          <button type="button" className="btn btn-secundario" onClick={() => setRecargar((n) => n + 1)}>
            Reintentar
          </button>
        </div>
      )}

      {!cargando && !error && cajasFiltradas.length === 0 && (
        <p className="orden-mensaje orden-mensaje-pendiente cajas-mensaje">
          {hayFiltros
            ? 'No hay cajas que coincidan con los filtros seleccionados.'
            : 'Todavía no hay cajas registradas en el sistema.'}
        </p>
      )}

      {!cargando && !error && cajasFiltradas.length > 0 && (
        <div className="cajas-grid">
          {cajasFiltradas.map((c) => {
            const abierta = c.estado === 'ABIERTA'
            const activa = c.activa
            return (
              <article
                key={c.codigo}
                className={`caja-card${abierta ? ' caja-card--abierta' : ''}${activa ? '' : ' caja-card--inactiva'}`}
              >
                <div className="caja-card-encabezado">
                  <span className="caja-card-codigo">{c.codigo}</span>
                  <span className="caja-card-nombre">{c.nombre || 'Sin nombre'}</span>
                </div>

                <div className="caja-card-badges">
                  <span className={`badge-estado ${abierta ? 'badge-caja--abierta' : 'badge-caja--cerrada'}`}>
                    {abierta ? 'Abierta' : 'Cerrada'}
                  </span>
                  <span className={`badge-estado ${activa ? 'badge-caja--activa' : 'badge-caja--inactiva'}`}>
                    {activa ? 'Activa' : 'Inactiva'}
                  </span>
                </div>

                <p className="caja-card-detalle">
                  {!activa
                    ? 'Caja deshabilitada, no se pueden abrir turnos'
                    : abierta
                      ? 'Con turno vigente'
                      : 'Sin turno vigente'}
                </p>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default EstadoCajas
