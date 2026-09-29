import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { generarReporteCierre, cerrarTurno, urlReporteCierrePdf } from '../api/caja.js'
import { obtenerTurnoActual } from '../api/turnos.js'
import { useAuth } from '../context/AuthContext.jsx'

function CierreCaja() {
  const { cajero } = useAuth()
  const navigate = useNavigate()

  const [turnoActual, setTurnoActual] = useState(null) // { id, codigo } del turno abierto en la caja
  const [cargandoTurno, setCargandoTurno] = useState(true)
  const [errorTurno, setErrorTurno] = useState(null)

  const [paso, setPaso] = useState('ingreso') // ingreso, reporte, listo
  const [supervisorId, setSupervisorId] = useState('')
  const [pin, setPin] = useState('')
  const [reporte, setReporte] = useState(null)
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(false)

  // El turno (de caja) sale de la caja del cajero logueado, no se escribe a mano.
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

  const turnoId = turnoActual?.id

  const manejarContinuar = async (e) => {
    e.preventDefault()
    if (!supervisorId.trim() || !pin.trim()) {
      setError('Ingrese el usuario y el PIN de un supervisor de caja para poder cerrar la caja.')
      return
    }

    setCargando(true)
    setError(null)
    try {
      const { data } = await generarReporteCierre(turnoId)
      setReporte(data)
      setPaso('reporte')
    } catch (err) {
      setError(err.mensaje || err.message)
    } finally {
      setCargando(false)
    }
  }

  const manejarCerrarCaja = async () => {
    setCargando(true)
    setError(null)
    try {
      await cerrarTurno(turnoId, { supervisor_id: supervisorId.trim(), pin: pin.trim() })
      // El reporte en PDF (con firma del cajero) se abre en una pestaña nueva
      // apenas se cierra la caja, para que se pueda imprimir o guardar al toque.
      window.open(urlReporteCierrePdf(turnoId), '_blank', 'noopener,noreferrer')
      setPaso('listo')
    } catch (err) {
      // Si el PIN es incorrecto (o vencio el intento), se vuelve a la pantalla de
      // autorizacion para corregirlo, en vez de perder el reporte ya generado.
      setPaso('ingreso')
      setError(err.mensaje || err.message)
    } finally {
      setCargando(false)
    }
  }

  if (cargandoTurno) {
    return (
      <section>
        <h1>Cierre de Caja</h1>
        <p>Buscando el turno abierto de su caja...</p>
      </section>
    )
  }

  if (errorTurno || !turnoActual) {
    return (
      <section>
        <h1>Cierre de Caja</h1>
        <div className="error" style={{ padding: '1rem', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '8px' }}>
          {errorTurno || 'No hay un turno abierto en su caja. Abra un turno antes de cerrar caja.'}
        </div>
      </section>
    )
  }

  return (
    <section>
      <h1>Cierre de Caja</h1>

      {error && <div className="error" style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '8px' }}>{error}</div>}

      {paso === 'ingreso' && (
        <div style={{ maxWidth: '400px', margin: 'auto', padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
          <h3>Por favor, ingrese los datos del supervisor de caja para cerrar caja</h3>
          <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1rem' }}>
            Pida a un supervisor de caja su usuario y PIN para poder cerrar el turno.
          </p>
          <form onSubmit={manejarContinuar}>
            <label className="campo" style={{ display: 'block', marginBottom: '1rem' }}>
              Usuario del supervisor
              <input
                type="text"
                value={supervisorId}
                onChange={(e) => {
                  setSupervisorId(e.target.value)
                  setError(null)
                }}
                style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
              />
            </label>

            <label className="campo" style={{ display: 'block', marginBottom: '1rem' }}>
              PIN del supervisor
              <input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value)
                  setError(null)
                }}
                style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
              />
            </label>

            <button type="submit" className="btn" disabled={cargando} style={{ width: '100%' }}>
              {cargando ? 'Generando Reporte...' : 'Continuar al Reporte'}
            </button>
          </form>
        </div>
      )}

      {paso === 'reporte' && reporte && (
        <div style={{ maxWidth: '600px', margin: 'auto' }}>
          <div style={{ padding: '1.5rem', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: '#f9fafb' }}>
            <h3 style={{ borderBottom: '1px solid #d1d5db', paddingBottom: '0.5rem' }}>Reporte de Cierre de Turno #{turnoActual.codigo ?? turnoId}</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', margin: '1rem 0' }}>
              <div style={{ padding: '1rem', backgroundColor: '#ecfdf5', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#065f46' }}>Efectivo</p>
                <p style={{ margin: 0, fontSize: '1.3rem', fontWeight: 'bold', color: '#065f46' }}>
                  Bs. {reporte.totalesPorMetodo?.Efectivo?.neto ?? 0}
                </p>
              </div>
              <div style={{ padding: '1rem', backgroundColor: '#eef2ff', borderRadius: '8px', border: '1px solid #c7d2fe' }}>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#3730a3' }}>Digital (Tarjeta + QR)</p>
                <p style={{ margin: 0, fontSize: '1.3rem', fontWeight: 'bold', color: '#3730a3' }}>
                  Bs. {reporte.resumenVentas?.totalDigital ?? 0}
                </p>
              </div>
            </div>

            <div style={{ padding: '1rem', backgroundColor: '#f1f5f9', borderRadius: '8px', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span><strong>Total recaudado:</strong> Bs. {reporte.totalRecaudado}</span>
              <span><strong>Ventas:</strong> {reporte.resumenVentas?.cantidadVentas ?? 0}</span>
              <span><strong>Facturas anuladas:</strong> {reporte.resumenVentas?.cantidadAnuladas ?? 0}</span>
              {reporte.resumenVentas?.cantidadAnuladas > 0 && (
                <span style={{ color: '#b91c1c' }}>(Bs. {reporte.resumenVentas.montoAnulado} anulados, no contados)</span>
              )}
            </div>

            <div style={{ marginTop: '1rem' }}>
              <h4>Resumen Medios de Pago:</h4>
              <ul style={{ listStyleType: 'none', padding: 0 }}>
                {Object.entries(reporte.totalesPorMetodo || {}).map(([metodo, totales]) => (
                   <li key={metodo}>{metodo}: Bs. {totales.neto} ({totales.operaciones} op.)</li>
                ))}
              </ul>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button
                type="button"
                className="btn btn-secundario"
                onClick={() => setPaso('ingreso')}
                disabled={cargando}
                style={{ flex: 1 }}
              >
                Volver
              </button>
              <button
                type="button"
                className="btn"
                onClick={manejarCerrarCaja}
                disabled={cargando}
                style={{ flex: 2, backgroundColor: '#dc2626' }}
              >
                {cargando ? 'Cerrando Turno...' : 'Cerrar caja y continuar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {paso === 'listo' && (
        <div style={{ maxWidth: '400px', margin: 'auto', textAlign: 'center', padding: '2rem', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: '#ecfdf5' }}>
          <h2 style={{ color: '#065f46' }}>Caja Cerrada Exitosamente</h2>
          <p style={{ color: '#064e3b', marginBottom: '1rem' }}>
            El turno #{turnoActual.codigo ?? turnoId} ha sido cerrado. El reporte en PDF se abrió en una pestaña nueva.
          </p>
          <button type="button" className="btn" onClick={() => navigate('/')}>Volver al Inicio</button>
        </div>
      )}
    </section>
  )
}

export default CierreCaja
