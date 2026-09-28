import { useEffect, useState } from 'react'
import { obtenerResumenVentas } from '../api/resumenVentas.js'
import { obtenerTurnoActual } from '../api/turnos.js'
import { useAuth } from '../context/AuthContext.jsx'

// TDSI-333: turnos del día. "Noche" cruza la medianoche (18:00-01:00); el backend
// interpreta desde > hasta como un rango que envuelve la medianoche.
const TURNOS_DIA = [
  { id: 'MANANA', etiqueta: 'Mañana (06:00 - 12:00)', desde: '06:00', hasta: '12:00' },
  { id: 'TARDE', etiqueta: 'Tarde (12:00 - 18:00)', desde: '12:00', hasta: '18:00' },
  { id: 'NOCHE', etiqueta: 'Noche (18:00 - 01:00)', desde: '18:00', hasta: '01:00' },
]

// TDSI-102: vista de resumen de ventas del día (del turno actual del cajero).
function ResumenVentas() {
  const { cajero } = useAuth()

  const [turnoActual, setTurnoActual] = useState(null) // { id, codigo } del turno abierto en la caja
  const [cargandoTurno, setCargandoTurno] = useState(true)
  const [errorTurno, setErrorTurno] = useState(null)

  const [turnoDiaId, setTurnoDiaId] = useState('')
  const [resumen, setResumen] = useState(null)
  const [errorApi, setErrorApi] = useState(null)
  const [cargando, setCargando] = useState(false)

  // TDSI-329: el turno (de caja) sale solo de la caja del cajero logueado, no se escribe a mano.
  useEffect(() => {
    if (!cajero?.caja) {
      setCargandoTurno(false)
      return
    }
    setCargandoTurno(true)
    obtenerTurnoActual(cajero.caja)
      .then((r) => setErrorTurno(null) || setTurnoActual(r.data))
      .catch((err) => setErrorTurno(err.message))
      .finally(() => setCargandoTurno(false))
  }, [cajero?.caja])

  async function consultarConTurnoDia(id) {
    setTurnoDiaId(id)
    const turno = TURNOS_DIA.find((t) => t.id === id)
    if (!turno || !turnoActual) return

    setErrorApi(null)
    setCargando(true)
    try {
      const respuesta = await obtenerResumenVentas(turnoActual.id, { desde: turno.desde, hasta: turno.hasta })
      setResumen(respuesta.data)
    } catch (err) {
      setResumen(null)
      setErrorApi(err.message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <section>
      <h1>Resumen de ventas del día</h1>

      {!cajero?.caja && !cargandoTurno && <p className="error">Inicia sesión en un terminal para ver el resumen de tu turno.</p>}
      {cargandoTurno && <p>Buscando el turno abierto de tu caja...</p>}
      {errorTurno && <p className="error">Error: {errorTurno}</p>}

      {turnoActual && (
        <>
          <p className="resumen-turno-actual">Turno actual: {turnoActual.codigo} ({cajero.caja})</p>

          {/* TDSI-333: barra plegable con los turnos del día */}
          <label className="campo campo-turno-dia">
            Turno del día
            <select value={turnoDiaId} onChange={(e) => consultarConTurnoDia(e.target.value)}>
              <option value="" disabled>
                Selecciona un turno...
              </option>
              {TURNOS_DIA.map((turno) => (
                <option key={turno.id} value={turno.id}>
                  {turno.etiqueta}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {cargando && <p>Cargando resumen...</p>}
      {errorApi && <p className="error">Error: {errorApi}</p>}

      {/* TDSI-334: mensaje cuando no hay ventas registradas en el turno */}
      {resumen && resumen.porMetodo.length === 0 && <p>No hay ventas registradas en ese turno del día.</p>}

      {/* TDSI-332: totales por método de pago en tarjetas */}
      {resumen && resumen.porMetodo.length > 0 && (
        <>
          <div className="resumen-cards">
            {resumen.porMetodo.map((m) => (
              <div key={m.metodo} className="resumen-card">
                <span className="resumen-card-metodo">{m.metodo}</span>
                <span className="resumen-card-total">Bs. {m.total.toFixed(2)}</span>
                <span className="resumen-card-cantidad">{m.cantidad} venta{m.cantidad === 1 ? '' : 's'}</span>
              </div>
            ))}
          </div>
          <p className="resumen-total">Total del turno: Bs. {resumen.totalGeneral.toFixed(2)}</p>
        </>
      )}
    </section>
  )
}

export default ResumenVentas
