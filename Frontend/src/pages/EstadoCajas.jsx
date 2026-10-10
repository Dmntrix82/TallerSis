import { useEffect, useState } from 'react'

// TDSI-126: vista del administrador con el estado de cada caja (terminal).
// TDSI-495: una tarjeta por caja.
// TDSI-496: insignias de estado (Abierta/Cerrada y Activa/Inactiva) con colores.
// TDSI-497: filtros por estado operativo y por actividad.
// TDSI-498: mensajes de "sin cajas" y de error.
//
// Por ahora usa datos de prueba locales; la conexion con el backend se hara despues
// reemplazando obtenerEstadoCajasPrueba por la llamada real.
const CAJAS_PRUEBA = [
  { codigo: 'CAJA-01', nombre: 'Caja principal', estado: 'ACTIVA', operativo: 'ABIERTA', cajero_nombre: 'María López', abierto_en: '2026-10-10T08:02:00' },
  { codigo: 'CAJA-02', nombre: 'Caja rápida', estado: 'ACTIVA', operativo: 'CERRADA', cajero_nombre: null, abierto_en: null },
  { codigo: 'CAJA-03', nombre: 'Caja de repuestos', estado: 'ACTIVA', operativo: 'ABIERTA', cajero_nombre: 'Juan Pérez', abierto_en: '2026-10-10T09:15:00' },
  { codigo: 'CAJA-04', nombre: 'Caja del segundo piso', estado: 'INACTIVA', operativo: 'CERRADA', cajero_nombre: null, abierto_en: null },
  { codigo: 'CAJA-05', nombre: 'Caja de servicio técnico', estado: 'ACTIVA', operativo: 'CERRADA', cajero_nombre: null, abierto_en: null },
]

function obtenerEstadoCajasPrueba() {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ data: CAJAS_PRUEBA }), 400)
  })
}

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
    obtenerEstadoCajasPrueba()
      .then((r) => setCajas(r.data))
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false))
  }, [recargar])

  const hayFiltros = filtroEstado || filtroActividad
  const cajasFiltradas = cajas.filter(
    (c) => (!filtroEstado || c.operativo === filtroEstado) && (!filtroActividad || c.estado === filtroActividad)
  )

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
            const abierta = c.operativo === 'ABIERTA'
            const activa = c.estado === 'ACTIVA'
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
                  {abierta ? (
                    <>
                      Cajero: <strong>{c.cajero_nombre}</strong>
                      <br />
                      Abierta desde las {new Date(c.abierto_en).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </>
                  ) : (
                    'Sin turno vigente'
                  )}
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
