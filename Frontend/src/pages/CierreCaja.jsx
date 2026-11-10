import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { generarReporteCierre, cerrarTurno, urlReporteCierrePdf, obtenerAnuladasTurno } from '../api/caja.js'
import { obtenerTurnoActual } from '../api/turnos.js'
import { useAuth } from '../context/AuthContext.jsx'
import ArqueoEfectivo, { ResumenArqueo } from '../components/ArqueoEfectivo.jsx'
import CampoPassword from '../components/CampoPassword.jsx'
import { arqueoEsValido, arqueoTieneConteo, totalContadoCentavos, detalleArqueo } from '../utils/arqueo.js'

function CierreCaja() {
  const { cajero, cerrarSesion } = useAuth()
  const navigate = useNavigate()

  function volverAIniciarSesion() {
    cerrarSesion()
    navigate('/login')
  }

  const [turnoActual, setTurnoActual] = useState(null) 
  const [cargandoTurno, setCargandoTurno] = useState(true)
  const [errorTurno, setErrorTurno] = useState(null)

  const [paso, setPaso] = useState('ingreso')
  const [supervisorId, setSupervisorId] = useState('')
  const [pin, setPin] = useState('')
  const [cantidades, setCantidades] = useState({})
  
  const efectivoContado = totalContadoCentavos(cantidades) / 100
  const [reporte, setReporte] = useState(null)
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(false)

  // TDSI-49/176: ventana con el detalle de facturas anuladas del turno.
  const [mostrandoAnuladas, setMostrandoAnuladas] = useState(false)
  const [anuladas, setAnuladas] = useState(null)
  const [cargandoAnuladas, setCargandoAnuladas] = useState(false)
  const [errorAnuladas, setErrorAnuladas] = useState(null)

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
  const efectivoEsperado = reporte?.arqueoEfectivo?.efectivoEsperado ?? reporte?.totalesPorMetodo?.Efectivo?.neto ?? 0

  const manejarContinuar = async (e) => {
    e.preventDefault()
    if (!supervisorId.trim() || !pin.trim()) {
      setError('Ingrese el usuario y el PIN de un supervisor de caja para poder cerrar la caja.')
      return
    }
    if (!arqueoEsValido(cantidades) || !arqueoTieneConteo(cantidades)) {
      setError('Complete el arqueo de efectivo con números enteros para poder cerrar la caja.')
      return
    }

    setCargando(true)
    setError(null)
    try {
      const { data } = await generarReporteCierre(turnoId, Number(efectivoContado))
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
      const arqueo = detalleArqueo(cantidades)
      await cerrarTurno(turnoId, { supervisor_id: supervisorId.trim(), pin: pin.trim(), efectivo_contado: Number(efectivoContado), arqueo })
      
      window.open(urlReporteCierrePdf(turnoId, Number(efectivoContado)), '_blank', 'noopener,noreferrer')
      setPaso('listo')
    } catch (err) {
      setPaso('ingreso')
      setError(err.mensaje || err.message)
    } finally {
      setCargando(false)
    }
  }

  async function abrirAnuladas() {
    setMostrandoAnuladas(true)
    setCargandoAnuladas(true)
    setErrorAnuladas(null)
    try {
      const { data } = await obtenerAnuladasTurno(turnoId)
      setAnuladas(data)
    } catch (err) {
      setErrorAnuladas(err.mensaje || err.message)
    } finally {
      setCargandoAnuladas(false)
    }
  }

  function cerrarAnuladas() {
    setMostrandoAnuladas(false)
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
        <div style={{ maxWidth: '480px', margin: 'auto', padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
          <h3>Por favor, ingrese los datos del supervisor de caja para cerrar caja</h3>
          <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1rem' }}>
            Pida a un supervisor de caja su usuario y PIN para poder cerrar el turno.
          </p>
          <form onSubmit={manejarContinuar}>
            <label className="campo" style={{ display: 'block', marginBottom: '1rem' }}>
              Usuario del supervisor
              <input
                type="text"
                autoComplete="off"
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
              <CampoPassword
                inputMode="numeric"
                autoComplete="new-password"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value)
                  setError(null)
                }}
                style={{ width: '100%', padding: '0.5rem', paddingRight: '2rem', marginTop: '0.25rem' }}
              />
            </label>

            <ArqueoEfectivo
              cantidades={cantidades}
              onChange={(nuevas) => {
                setCantidades(nuevas)
                setError(null)
              }}
              mostrarDiferencia={false}
            />

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
                <>
                  <span style={{ color: '#b91c1c' }}>(Bs. {reporte.resumenVentas.montoAnulado} anulados, no contados)</span>
                  <button type="button" className="btn btn-secundario" onClick={abrirAnuladas} style={{ padding: '0.35rem 0.75rem' }}>
                    Ver anuladas
                  </button>
                </>
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

            <ResumenArqueo cantidades={cantidades} efectivoEsperado={efectivoEsperado} />

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

      {mostrandoAnuladas && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Facturas anuladas del turno">
          <div className="rt-modal-facturas">
            <button type="button" className="rt-modal-cerrar" onClick={cerrarAnuladas} aria-label="Cerrar">
              ✕
            </button>
            <h3 style={{ marginTop: 0 }}>Facturas anuladas del turno</h3>

            {cargandoAnuladas && <p>Cargando...</p>}

            {!cargandoAnuladas && errorAnuladas && (
              <div className="error" style={{ padding: '1rem', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '8px' }}>
                No se pudo cargar la lista de anuladas: {errorAnuladas}
              </div>
            )}

            {!cargandoAnuladas && !errorAnuladas && anuladas && (
              <table className="tabla-facturas">
                <thead>
                  <tr>
                    <th>N° Factura</th>
                    <th>Hora</th>
                    <th>Total (Bs.)</th>
                    <th>Motivo</th>
                    <th>Supervisor</th>
                  </tr>
                </thead>
                <tbody>
                  {anuladas.anuladas.map((a) => (
                    <tr key={a.numero_factura}>
                      <td>{a.numero_factura}</td>
                      <td>{new Date(a.hora).toLocaleTimeString()}</td>
                      <td>{a.total.toFixed(2)}</td>
                      <td>{a.motivo || '—'}</td>
                      <td>{a.supervisor || '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}><strong>Total anulado</strong></td>
                    <td><strong>{anuladas.montoAnulado.toFixed(2)}</strong></td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      )}

      {paso === 'listo' && (
        <div style={{ maxWidth: '520px', margin: 'auto', textAlign: 'center', padding: '2rem', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: '#ecfdf5' }}>
          <h2 style={{ color: '#065f46' }}>Caja Cerrada Exitosamente</h2>
          <p style={{ color: '#064e3b', marginBottom: '1rem' }}>
            El turno #{turnoActual.codigo ?? turnoId} ha sido cerrado. El reporte en PDF se abrió en una pestaña nueva.
          </p>
          <div style={{ textAlign: 'left', margin: '0 0 1.5rem' }}>
            <ResumenArqueo cantidades={cantidades} efectivoEsperado={efectivoEsperado} />
          </div>
          <button type="button" className="btn" onClick={volverAIniciarSesion}>Volver al Inicio</button>
        </div>
      )}
    </section>
  )
}

export default CierreCaja