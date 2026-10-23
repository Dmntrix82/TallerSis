import { useState } from 'react'

// TDSI-508: el supervisor aprueba o rechaza una operacion especial con su usuario y PIN.
// TDSI-510: el motivo es obligatorio al rechazar y opcional al aprobar.
function DecisionOperacionModal({ operacion, etiquetaTipo, accion, onConfirmar, onCancelar }) {
  const [supervisorId, setSupervisorId] = useState('')
  const [pin, setPin] = useState('')
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  const esRechazo = accion === 'RECHAZAR'

  async function enviar(event) {
    event.preventDefault()
    if (!supervisorId.trim() || !pin.trim()) {
      setError('Ingrese su usuario y PIN de supervisor de caja.')
      return
    }
    if (esRechazo && !motivo.trim()) {
      setError('Escriba el motivo del rechazo.')
      return
    }

    setEnviando(true)
    setError(null)
    try {
      await onConfirmar({
        supervisor_id: supervisorId.trim(),
        pin: pin.trim(),
        ...(motivo.trim() && { motivo: motivo.trim() }),
      })
    } catch (err) {
      // Si falla (PIN incorrecto, ya resuelta por otro supervisor...), el modal sigue abierto.
      setError(err.mensaje || err.message)
      setEnviando(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-caja">
        <h2>{esRechazo ? 'Rechazar operación' : 'Aprobar operación'}</h2>
        <div className="solicitud-resumen">
          <p><strong>{etiquetaTipo}</strong> · {operacion.caja_id}</p>
          <p>{operacion.descripcion}</p>
          {operacion.monto != null && <p>Monto: Bs. {operacion.monto.toFixed(2)}</p>}
          <p>Solicitada por {operacion.solicitado_por_nombre || operacion.solicitado_por}</p>
        </div>

        <form onSubmit={enviar}>
          <label className="campo">
            Usuario del supervisor
            <input
              type="text"
              autoComplete="off"
              value={supervisorId}
              onChange={(e) => {
                setSupervisorId(e.target.value)
                setError(null)
              }}
            />
          </label>

          <label className="campo">
            PIN del supervisor
            <input
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value)
                setError(null)
              }}
            />
          </label>

          <label className="campo">
            {esRechazo ? 'Motivo del rechazo' : 'Motivo (opcional)'}
            <textarea
              rows={3}
              maxLength={300}
              value={motivo}
              onChange={(e) => {
                setMotivo(e.target.value)
                setError(null)
              }}
            />
          </label>

          {error && <p className="error">{error}</p>}

          <button type="submit" className={`btn${esRechazo ? ' btn-peligro' : ''}`} disabled={enviando}>
            {enviando ? 'Enviando...' : esRechazo ? 'Rechazar operación' : 'Aprobar operación'}
          </button>
          <button type="button" className="btn btn-secundario" onClick={onCancelar} disabled={enviando}>
            Cancelar
          </button>
        </form>
      </div>
    </div>
  )
}

export default DecisionOperacionModal
