import { useEffect, useState } from 'react'
import { obtenerRecaudadoPorCaja } from '../api/caja.js'

const METODOS = ['Efectivo', 'Tarjeta', 'QR']

function hoyLocal() {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

// Ahora devuelve el string YYYY-MM-DD, no el ISO completo
function rangoDelDia(fecha) {
  return {
    desde: fecha,
    hasta: fecha, // El backend acepta un solo día como desde y hasta
  }
}

function RecaudadoCajas() {
  const [fecha, setFecha] = useState(hoyLocal)
  const [cajas, setCajas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [recargar, setRecargar] = useState(0)

  useEffect(() => {
    if (!fecha) return
    let vigente = true
    setCargando(true)
    setError(null)
    obtenerRecaudadoPorCaja(rangoDelDia(fecha))
      .then((r) => vigente && setCajas(r.data))
      .catch((err) => vigente && setError(err.mensaje || err.message))
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [fecha, recargar])

  const hayMovimientos = cajas.some((c) => c.operaciones > 0)

  return (
    <section>
      <h1>Total recaudado por caja</h1>
      <p className="resumen-turno-actual">
        Lo que recaudó cada caja activa en el día elegido: ingresos, egresos, neto y desglose por método de pago.
      </p>

      <div className="filtro-fechas">
        <label className="campo">
          Fecha
          <input type="date" value={fecha} max={hoyLocal()} onChange={(e) => setFecha(e.target.value)} />
        </label>
        {fecha !== hoyLocal() && (
          <button type="button" className="btn btn-secundario" onClick={() => setFecha(hoyLocal())}>
            Hoy
          </button>
        )}
      </div>

      {cargando && <p>Cargando...</p>}

      {!cargando && error && (
        <div className="orden-mensaje orden-mensaje-error cajas-mensaje">
          <span>No se pudo obtener lo recaudado: {error}</span>
          <button type="button" className="btn btn-secundario" onClick={() => setRecargar((n) => n + 1)}>
            Reintentar
          </button>
        </div>
      )}

      {!cargando && !error && cajas.length === 0 && (
        <p className="orden-mensaje orden-mensaje-pendiente cajas-mensaje">No hay cajas activas registradas.</p>
      )}

      {!cargando && !error && cajas.length > 0 && !hayMovimientos && (
        <p className="orden-mensaje orden-mensaje-pendiente cajas-mensaje">
          Ninguna caja tuvo movimientos en esta fecha.
        </p>
      )}

      {!cargando && !error && hayMovimientos && (
        <div className="cajas-grid">
          {cajas.map((c) => (
            <article key={c.caja_id} className={`caja-card${c.operaciones > 0 ? ' caja-card--abierta' : ''}`}>
              <div className="caja-card-encabezado">
                <span className="caja-card-codigo">{c.caja_id}</span>
                <span className="caja-card-nombre">{c.caja_nombre || 'Sin nombre'}</span>
              </div>

              <dl className="recaudado-totales">
                <div>
                  <dt>Ingresos</dt>
                  <dd>Bs. {c.totalIngresos.toFixed(2)}</dd>
                </div>
                <div>
                  <dt>Egresos</dt>
                  <dd>Bs. {c.totalEgresos.toFixed(2)}</dd>
                </div>
                <div className="recaudado-neto">
                  <dt>Neto</dt>
                  <dd>Bs. {c.totalRecaudado.toFixed(2)}</dd>
                </div>
              </dl>

              {c.operaciones === 0 ? (
                <p className="caja-card-detalle">Sin movimientos</p>
              ) : (
                <ul className="recaudado-metodos">
                  {METODOS.map((m) => {
                    const metodo = c.porMetodo[m]
                    return (
                      <li key={m}>
                        <span>{m}</span>
                        <span className="recaudado-metodo-operaciones">
                          {metodo.operaciones === 1 ? '1 operación' : `${metodo.operaciones} operaciones`}
                        </span>
                        <span className="recaudado-metodo-neto">Bs. {metodo.neto.toFixed(2)}</span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default RecaudadoCajas