import { useState } from 'react'
// TDSI-44: respuestas rapidas del cajero (componente de esa historia).
import RespuestasRapidasBotones from './RespuestasRapidasBotones.jsx'

// Los mismos valores que acepta el backend (columna motivo de pagos.ventas_canceladas).
const MOTIVOS = ['El cliente desistió', 'Fondos insuficientes', 'Error al cargar ítems', 'Otro']
const LARGO_MAXIMO_TEXTO = 300

// TDSI-842: modal "Cancelar venta" con la lista de motivos. "Otro" pide escribir el motivo.
// No pide supervisor: la venta no se cobro ni se emitio factura.
// TDSI-44: las respuestas rapidas del cajero cancelan la venta con un solo clic.
function CancelarVentaModal({ total, cajeroId, onConfirmar, onVolver }) {
  const [motivo, setMotivo] = useState(null)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  async function enviar(datosMotivo) {
    setEnviando(true)
    setError(null)
    try {
      await onConfirmar(datosMotivo)
    } catch (err) {
      // Si el registro falla, el modal queda abierto con el motivo elegido para reintentar.
      setError(err.message)
      setEnviando(false)
    }
  }

  function confirmar(event) {
    event.preventDefault()
    if (!motivo) {
      setError('Elija el motivo de la cancelación.')
      return
    }
    if (motivo === 'Otro' && !texto.trim()) {
      setError('Escriba el motivo de la cancelación.')
      return
    }
    enviar(motivo === 'Otro' ? { motivo, motivo_texto: texto.trim() } : { motivo })
  }

  return (
    <div className="modal-overlay">
      <form className="modal-caja cancelar-venta" onSubmit={confirmar} role="dialog" aria-modal="true" aria-labelledby="titulo-cancelar-venta">
        <h2 id="titulo-cancelar-venta">Cancelar venta</h2>
        <p className="cancelar-venta-resumen">
          Venta de Bs. {total.toFixed(2)} sin cobrar. No se genera cobro ni factura.
        </p>

        <div className="cancelar-venta-rapidas">
          <p className="cancelar-venta-subtitulo">Mis respuestas rápidas</p>
          <RespuestasRapidasBotones cajeroId={cajeroId} onElegir={enviar} disabled={enviando} />
        </div>

        <fieldset className="cancelar-venta-motivos">
          <legend>¿Por qué se cancela?</legend>
          {MOTIVOS.map((m) => (
            <label key={m} className={`cancelar-venta-motivo${motivo === m ? ' activa' : ''}`}>
              <input
                type="radio"
                name="motivo-cancelacion"
                value={m}
                checked={motivo === m}
                onChange={() => {
                  setMotivo(m)
                  setError(null)
                }}
              />
              {m}
            </label>
          ))}
        </fieldset>

        {motivo === 'Otro' && (
          <label className="campo">
            Motivo
            <textarea
              rows={3}
              maxLength={LARGO_MAXIMO_TEXTO}
              value={texto}
              autoFocus
              onChange={(e) => {
                setTexto(e.target.value)
                setError(null)
              }}
            />
          </label>
        )}

        {error && <p className="error">{error}</p>}

        <button type="submit" className="btn btn-peligro" disabled={enviando}>
          {enviando ? 'Cancelando...' : 'Cancelar venta'}
        </button>
        <button type="button" className="btn btn-secundario" onClick={onVolver} disabled={enviando}>
          Volver
        </button>
      </form>
    </div>
  )
}

export default CancelarVentaModal
