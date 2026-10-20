import { useEffect, useState } from 'react'
import { listarAnulacionesPendientes, autorizarAnulacionPendiente } from '../api/pagos.js'

const CREDENCIALES_INICIAL = { supervisor_id: '', pin: '', observacion: '' }

// TDSI-28/563-566: bandeja del administrador con las solicitudes de anulación
// que quedaron en espera porque no había un supervisor presente en la caja.
function AnulacionesPendientes() {
  const [solicitudes, setSolicitudes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [mensaje, setMensaje] = useState(null) // { ok, texto } | null

  const [solicitudElegida, setSolicitudElegida] = useState(null)
  const [decision, setDecision] = useState(null) // 'APROBAR' | 'RECHAZAR'
  const [credenciales, setCredenciales] = useState(CREDENCIALES_INICIAL)
  const [errorCredenciales, setErrorCredenciales] = useState(null)
  const [enviando, setEnviando] = useState(false)

  async function cargar() {
    setCargando(true)
    try {
      const r = await listarAnulacionesPendientes()
      setSolicitudes(r.data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  function abrir(solicitud, dec) {
    setSolicitudElegida(solicitud)
    setDecision(dec)
    setCredenciales(CREDENCIALES_INICIAL)
    setErrorCredenciales(null)
    setMensaje(null)
  }

  function cerrar() {
    setSolicitudElegida(null)
    setDecision(null)
    setErrorCredenciales(null)
  }

  function actualizarCredencial(campo, valor) {
    setCredenciales((prev) => ({ ...prev, [campo]: valor }))
  }

  async function resolver(event) {
    event.preventDefault()
    if (!credenciales.supervisor_id.trim() || !credenciales.pin.trim()) {
      setErrorCredenciales('Ingrese el usuario y el PIN del supervisor.')
      return
    }

    setEnviando(true)
    setErrorCredenciales(null)
    try {
      await autorizarAnulacionPendiente(solicitudElegida.id, {
        supervisor_id: credenciales.supervisor_id.trim(),
        pin: credenciales.pin.trim(),
        decision,
        observacion: credenciales.observacion.trim() || undefined,
      })
      setMensaje({
        ok: true,
        texto:
          decision === 'APROBAR'
            ? `La factura ${solicitudElegida.id_transaccion} quedó Anulada.`
            : `Se rechazó la solicitud de ${solicitudElegida.id_transaccion}; la venta sigue Emitida.`,
      })
      cerrar()
      await cargar()
    } catch (err) {
      // TDSI-610: PIN incorrecto -- se muestra el error y la factura no cambia de estado.
      setErrorCredenciales(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section>
      <h1>Anulaciones pendientes</h1>
      <p className="resumen-turno-actual">
        Solicitudes de anulación que quedaron en espera porque no había un supervisor en la caja.
      </p>

      {mensaje && <p className={mensaje.ok ? 'mensaje-exito' : 'error'}>{mensaje.texto}</p>}

      {cargando && <p>Cargando...</p>}
      {error && <p className="error">Error: {error}</p>}

      {!cargando && !error && solicitudes.length === 0 && <p>No hay solicitudes pendientes por el momento.</p>}

      {solicitudes.length > 0 && (
        <table className="tabla-facturas">
          <thead>
            <tr>
              <th>Número</th>
              <th>Cliente</th>
              <th>Monto (Bs.)</th>
              <th>Motivo</th>
              <th>Solicitado por</th>
              <th>Fecha</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {solicitudes.map((s) => (
              <tr key={s.id}>
                <td>{s.id_transaccion}</td>
                <td>{s.razon_social || 'Consumidor final'}</td>
                <td>{s.monto.toFixed(2)}</td>
                <td style={{ maxWidth: '240px' }}>{s.motivo}</td>
                <td>{s.solicitado_por || '-'}</td>
                <td>{new Date(s.solicitado_en).toLocaleString()}</td>
                <td style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button type="button" className="btn" onClick={() => abrir(s, 'APROBAR')}>
                    Aprobar
                  </button>
                  <button type="button" className="btn btn-secundario" onClick={() => abrir(s, 'RECHAZAR')}>
                    Rechazar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Ventana emergente: usuario + PIN del supervisor para resolver la solicitud */}
      {solicitudElegida && (
        <div className="modal-overlay">
          <form className="modal-caja" onSubmit={resolver}>
            <h2>{decision === 'APROBAR' ? 'Aprobar anulación' : 'Rechazar solicitud'}</h2>
            <p>
              Factura <strong>{solicitudElegida.id_transaccion}</strong> — Bs. {solicitudElegida.monto.toFixed(2)}
              <br />
              Motivo: {solicitudElegida.motivo}
            </p>

            <label className="campo">
              Usuario del supervisor
              <input
                type="text"
                autoComplete="off"
                value={credenciales.supervisor_id}
                onChange={(e) => actualizarCredencial('supervisor_id', e.target.value)}
                autoFocus
              />
            </label>

            <label className="campo">
              PIN
              <input
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                value={credenciales.pin}
                onChange={(e) => actualizarCredencial('pin', e.target.value)}
              />
            </label>

            <label className="campo">
              Observación (opcional)
              <textarea
                rows={2}
                maxLength={300}
                value={credenciales.observacion}
                onChange={(e) => actualizarCredencial('observacion', e.target.value)}
              />
            </label>

            {errorCredenciales && <p className="error">{errorCredenciales}</p>}

            <div className="pago-exito-acciones">
              <button type="button" className="btn btn-secundario" onClick={cerrar} disabled={enviando}>
                Cancelar
              </button>
              <button type="submit" className="btn" disabled={enviando}>
                {enviando ? 'Procesando...' : decision === 'APROBAR' ? 'Confirmar aprobación' : 'Confirmar rechazo'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}

export default AnulacionesPendientes
