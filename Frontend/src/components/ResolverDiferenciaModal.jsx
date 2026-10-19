import { useState } from 'react'

// TDSI-520: formulario para justificar y resolver una diferencia de caja.
// TDSI-522: la justificacion y el responsable son obligatorios; la fecha la registra el backend.
function ResolverDiferenciaModal({ diferencia, responsableInicial, onConfirmar, onCancelar }) {
  const [justificacion, setJustificacion] = useState('')
  const [responsable, setResponsable] = useState(responsableInicial ?? '')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  async function enviar(event) {
    event.preventDefault()
    if (!justificacion.trim()) {
      setError('La justificación es obligatoria para resolver la diferencia.')
      return
    }
    if (!responsable.trim()) {
      setError('Indique quién es el responsable de la resolución.')
      return
    }

    setEnviando(true)
    setError(null)
    try {
      await onConfirmar({ justificacion: justificacion.trim(), resuelta_por: responsable.trim() })
    } catch (err) {
      // Si falla (ya resuelta, error del servidor...), el modal sigue abierto para corregir.
      setError(err.mensaje || err.message)
      setEnviando(false)
    }
  }

  const esFaltante = diferencia.tipo === 'FALTANTE'

  return (
    <div className="modal-overlay">
      <div className="modal-caja">
        <h2>Resolver diferencia</h2>
        <div className="solicitud-resumen">
          <p><strong>{diferencia.caja_id}</strong> · Turno {diferencia.turno_id}</p>
          <p>
            {esFaltante ? 'Faltante' : 'Sobrante'} de Bs. {Math.abs(diferencia.monto).toFixed(2)}
          </p>
        </div>

        <form onSubmit={enviar}>
          <label className="campo">
            Justificación
            <textarea
              rows={4}
              maxLength={300}
              value={justificacion}
              onChange={(e) => {
                setJustificacion(e.target.value)
                setError(null)
              }}
              placeholder="Explique por qué se produjo la diferencia y cómo se resolvió."
            />
          </label>

          <label className="campo">
            Responsable
            <input
              type="text"
              maxLength={60}
              value={responsable}
              onChange={(e) => {
                setResponsable(e.target.value)
                setError(null)
              }}
            />
          </label>

          {error && <p className="error">{error}</p>}

          <button type="submit" className="btn" disabled={enviando}>
            {enviando ? 'Guardando...' : 'Marcar como resuelta'}
          </button>
          <button type="button" className="btn btn-secundario" onClick={onCancelar} disabled={enviando}>
            Cancelar
          </button>
        </form>
      </div>
    </div>
  )
}

export default ResolverDiferenciaModal
