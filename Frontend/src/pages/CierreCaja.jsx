import { useState } from 'react'
import { generarReporteCierre, cerrarTurno } from '../api/caja.js'

function CierreCaja() {
  const [paso, setPaso] = useState('ingreso') // ingreso, reporte, listo
  const [efectivoContado, setEfectivoContado] = useState('')
  const [reporte, setReporte] = useState(null)
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(false)

  // Asumimos un turnoId = 1 por defecto para la caja actual
  const turnoId = 1

  const manejarContinuar = async (e) => {
    e.preventDefault()
    if (!efectivoContado) {
      setError('Por favor, ingrese el monto contado en la caja.')
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
      await cerrarTurno(turnoId, Number(efectivoContado))
      setPaso('listo')
    } catch (err) {
      setError(err.mensaje || err.message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <section>
      <h1>Cierre de Caja</h1>
      
      {error && <div className="error" style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '8px' }}>{error}</div>}

      {paso === 'ingreso' && (
        <div style={{ maxWidth: '400px', margin: 'auto', padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
          <h3>Ingresar Efectivo Contado</h3>
          <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1rem' }}>
            Cuente el dinero físico en la caja e ingrese el total aquí.
          </p>
          <form onSubmit={manejarContinuar}>
            <label className="campo" style={{ display: 'block', marginBottom: '1rem' }}>
              Monto Contado (Bs.)
              <input
                type="number"
                step="0.01"
                min="0"
                value={efectivoContado}
                onChange={(e) => {
                  setEfectivoContado(e.target.value)
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
            <h3 style={{ borderBottom: '1px solid #d1d5db', paddingBottom: '0.5rem' }}>Reporte de Cierre de Turno #{turnoId}</h3>
            
            {reporte.arqueoEfectivo && (
              <>
                <div style={{ margin: '1rem 0' }}>
                  <p><strong>Efectivo Inicial:</strong> Bs. {reporte.arqueoEfectivo.efectivoInicial}</p>
                  <p><strong>Total Ventas Efectivo:</strong> Bs. {reporte.arqueoEfectivo.ventasEfectivo}</p>
                  <p><strong>Total Egresos Efectivo:</strong> Bs. {reporte.arqueoEfectivo.egresosEfectivo}</p>
                </div>

                <div style={{ padding: '1rem', backgroundColor: '#e5e7eb', borderRadius: '8px', marginBottom: '1rem' }}>
                  <p><strong>Efectivo Esperado en Caja:</strong> Bs. {reporte.arqueoEfectivo.efectivoEsperado}</p>
                  <p><strong>Efectivo Contado Ingresado:</strong> Bs. {reporte.arqueoEfectivo.efectivoContado}</p>
                </div>

                {reporte.arqueoEfectivo.diferencia !== 0 && (
                  <div style={{ padding: '1rem', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #fcd34d' }}>
                    <strong>⚠️ Diferencia Detectada:</strong>
                    <p>{reporte.arqueoEfectivo.tipoDiferencia}: Bs. {Math.abs(reporte.arqueoEfectivo.diferencia)}</p>
                    <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Esta diferencia se registrará en el sistema como un ajuste de inventario/caja.</p>
                  </div>
                )}
              </>
            )}

            <div style={{ marginTop: '1rem' }}>
              <h4>Resumen Medios de Pago (Neto):</h4>
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
                Modificar Efectivo
              </button>
              <button 
                type="button" 
                className="btn" 
                onClick={manejarCerrarCaja}
                disabled={cargando}
                style={{ flex: 2, backgroundColor: '#dc2626' }}
              >
                {cargando ? 'Cerrando Turno...' : 'Confirmar y Cerrar Caja'}
              </button>
            </div>
          </div>
        </div>
      )}

      {paso === 'listo' && (
        <div style={{ maxWidth: '400px', margin: 'auto', textAlign: 'center', padding: '2rem', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: '#ecfdf5' }}>
          <h2 style={{ color: '#065f46' }}>Caja Cerrada Exitosamente</h2>
          <p style={{ color: '#064e3b', marginBottom: '1rem' }}>El turno #{turnoId} ha sido cerrado.</p>
          <button type="button" className="btn" onClick={() => window.location.reload()}>Volver al Inicio</button>
        </div>
      )}
    </section>
  )
}

export default CierreCaja
