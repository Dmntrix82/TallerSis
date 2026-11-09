import { useEffect, useState } from 'react'
import { listarRespuestasRapidas } from '../api/respuestasRapidas.js'

// El registro de venta cancelada (POST /api/pagos/canceladas, TDSI-45) acepta motivos fijos o
// "Otro" con el texto escrito. Una respuesta rapida va como "Otro" con su texto copiado, asi la
// venta cancelada conserva el texto aunque despues la respuesta se edite o se elimine.
export function motivoDesdeRespuestaRapida(texto) {
  return { motivo: 'Otro', motivo_texto: texto }
}

// TDSI-44: respuestas rapidas del cajero como botones para el modal "Cancelar venta".
// Un clic ya elige la respuesta: onElegir recibe { motivo, motivo_texto } listo para enviar.
function RespuestasRapidasBotones({ cajeroId, onElegir, disabled = false }) {
  const [respuestas, setRespuestas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    setError(null)
    listarRespuestasRapidas(cajeroId)
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

  if (cargando) return <p className="ayuda-mixto">Cargando respuestas rápidas...</p>
  if (error) return <p className="error">No se pudieron cargar tus respuestas rápidas: {error}</p>
  if (respuestas.length === 0) {
    return <p className="respuestas-vacio">No tienes respuestas rápidas. Puedes crearlas en «Mis respuestas rápidas».</p>
  }

  return (
    <div className="respuestas-botones" role="group" aria-label="Respuestas rápidas">
      {respuestas.map((r) => (
        <button
          key={r.id}
          type="button"
          className="respuesta-rapida"
          disabled={disabled}
          onClick={() => onElegir(motivoDesdeRespuestaRapida(r.texto))}
        >
          {r.texto}
        </button>
      ))}
    </div>
  )
}

export default RespuestasRapidasBotones
