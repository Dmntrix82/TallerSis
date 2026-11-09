import { useEffect, useState } from 'react'
import { listarRespuestasAnulacion } from '../api/respuestasAnulacion.js'

// TDSI-896/897: respuestas de anulacion del cajero como botones, para ponerlos arriba del
// campo del motivo en el modal "Solicitar anulación". Un clic ya elige el motivo:
// onElegir recibe el texto copiado, asi la factura anulada lo conserva aunque despues la
// respuesta se edite o se elimine. Las clases son las de los botones de TDSI-44.
function RespuestasAnulacionBotones({ cajeroId, onElegir, disabled = false }) {
  const [respuestas, setRespuestas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    setError(null)
    listarRespuestasAnulacion(cajeroId)
      .then((r) => {
        if (!cancelado) setRespuestas(r.data)
      })
      .catch((err) => {
        if (!cancelado) setError(err.message)
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })
    return () => {
      cancelado = true
    }
  }, [cajeroId])

  if (cargando) return <p className="ayuda-mixto">Cargando tus respuestas de anulación...</p>
  if (error) return <p className="error">No se pudieron cargar tus respuestas de anulación: {error}</p>
  if (respuestas.length === 0) return null

  return (
    <div className="respuestas-botones" role="group" aria-label="Mis respuestas de anulación">
      {respuestas.map((r) => (
        <button key={r.id} type="button" className="respuesta-rapida" disabled={disabled} onClick={() => onElegir(r.texto)}>
          {r.texto}
        </button>
      ))}
    </div>
  )
}

export default RespuestasAnulacionBotones
