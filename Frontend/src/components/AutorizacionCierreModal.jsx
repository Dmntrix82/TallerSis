import { useState } from 'react'

const ETIQUETA_DIFERENCIA = {
  CUADRA: 'Cuadra',
  SOBRANTE: 'Sobrante',
  FALTANTE: 'Faltante',
}

// TDSI-130: formulario de autorizacion de cierre de caja. El supervisor pone su
// usuario y PIN para aprobar; para rechazar ademas tiene que escribir el motivo (TDSI-504).
// `arqueo` es la comparacion del efectivo contado con el esperado (puede no estar).
function AutorizacionCierreModal({ solicitud, arqueo, accion, onConfirmar, onCancelar }) {
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
        ...(esRechazo && { motivo_rechazo: motivo.trim() }),
      })
    } catch (err) {
      // Si falla (PIN incorrecto, solicitud ya resuelta...), el modal sigue abierto para corregir.
      setError(err.mensaje || err.message)
      setEnviando(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-caja">
        <h2>{esRechazo ? 'Rechazar cierre' : 'Autorizar cierre'}</h2>
        <div className="solicitud-resumen">
          <p><strong>{solicitud.caja_id}</strong> · {solicitud.cajero_nombre || solicitud.cajero_id}</p>
          <p>Efectivo contado: Bs. {solicitud.efectivo_contado.toFixed(2)}</p>
          {arqueo && (
            <>
              <p>Efectivo esperado: Bs. {arqueo.efectivoEsperado.toFixed(2)}</p>
              <p>
                Diferencia: Bs. {arqueo.diferencia.toFixed(2)} ({ETIQUETA_DIFERENCIA[arqueo.tipoDiferencia]})
              </p>
            </>
          )}
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

          {esRechazo && (
            <label className="campo">
              Motivo del rechazo
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
          )}

          {error && <p className="error">{error}</p>}

          <button type="submit" className={`btn${esRechazo ? ' btn-peligro' : ''}`} disabled={enviando}>
            {enviando ? 'Enviando...' : esRechazo ? 'Rechazar solicitud' : 'Aprobar y cerrar turno'}
          </button>
          <button type="button" className="btn btn-secundario" onClick={onCancelar} disabled={enviando}>
            Cancelar
          </button>
        </form>
      </div>
    </div>
  )
}

export default AutorizacionCierreModal
