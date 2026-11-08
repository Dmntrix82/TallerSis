import { useEffect, useState } from 'react'
import {
  listarRespuestasRapidas,
  crearRespuestaRapida,
  editarRespuestaRapida,
  eliminarRespuestaRapida,
  validarTextoRespuesta,
  MAXIMO_RESPUESTAS,
  LARGO_MAXIMO,
} from '../api/respuestasRapidas.js'

// Campo de texto con contador de caracteres, para crear y para editar una respuesta.
function CampoRespuesta({ id, valor, onCambiar, autoFocus }) {
  return (
    <>
      <textarea
        id={id}
        rows={2}
        maxLength={LARGO_MAXIMO}
        value={valor}
        autoFocus={autoFocus}
        onChange={(e) => onCambiar(e.target.value)}
      />
      <span className="respuestas-contador">
        {valor.trim().length}/{LARGO_MAXIMO}
      </span>
    </>
  )
}

// TDSI-44: panel "Mis respuestas rápidas" del cajero.
// Formulario "Nueva respuesta", edición y "Eliminar" con confirmación.
// Cada cajero ve solo las suyas (se piden por su cajero_id), y siguen ahí en otros turnos.
function MisRespuestasRapidas({ cajeroId, onCerrar }) {
  const [respuestas, setRespuestas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(null)
  const [intento, setIntento] = useState(0)

  const [nuevoTexto, setNuevoTexto] = useState('')
  const [editando, setEditando] = useState(null) // { id, texto }
  const [porEliminar, setPorEliminar] = useState(null) // id
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const [mensaje, setMensaje] = useState(null)

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    setErrorCarga(null)
    listarRespuestasRapidas(cajeroId)
      .then((r) => {
        if (!cancelado) setRespuestas(r.data)
      })
      .catch((err) => {
        if (!cancelado) setErrorCarga(err.message)
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })
    return () => {
      cancelado = true
    }
  }, [cajeroId, intento])

  const llegoAlMaximo = respuestas.length >= MAXIMO_RESPUESTAS

  function avisar(texto) {
    setError(null)
    setMensaje(texto)
  }

  async function guardarNueva(event) {
    event.preventDefault()
    const errorTexto = validarTextoRespuesta(nuevoTexto)
    if (errorTexto) {
      setMensaje(null)
      setError(errorTexto)
      return
    }
    if (llegoAlMaximo) return

    setEnviando(true)
    setError(null)
    try {
      // El backend guarda "orden" pero no lo calcula: se deja al final de la lista.
      const orden = Math.max(0, ...respuestas.map((r) => r.orden)) + 1
      const { data } = await crearRespuestaRapida({ cajero_id: cajeroId, texto: nuevoTexto.trim(), orden })
      setRespuestas((prev) => [...prev, data])
      setNuevoTexto('')
      avisar('Respuesta guardada.')
    } catch (err) {
      setMensaje(null)
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  async function guardarEdicion(event) {
    event.preventDefault()
    const errorTexto = validarTextoRespuesta(editando.texto)
    if (errorTexto) {
      setMensaje(null)
      setError(errorTexto)
      return
    }

    setEnviando(true)
    setError(null)
    try {
      const { data } = await editarRespuestaRapida(editando.id, { cajero_id: cajeroId, texto: editando.texto.trim() })
      setRespuestas((prev) => prev.map((r) => (r.id === data.id ? data : r)))
      setEditando(null)
      avisar('Respuesta actualizada.')
    } catch (err) {
      setMensaje(null)
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  async function confirmarEliminar(id) {
    setEnviando(true)
    setError(null)
    try {
      await eliminarRespuestaRapida(id, cajeroId)
      setRespuestas((prev) => prev.filter((r) => r.id !== id))
      setPorEliminar(null)
      avisar('Respuesta eliminada.')
    } catch (err) {
      setMensaje(null)
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-caja respuestas-panel" role="dialog" aria-modal="true" aria-labelledby="titulo-respuestas">
        <div className="respuestas-encabezado">
          <h2 id="titulo-respuestas">Mis respuestas rápidas</h2>
          <button type="button" className="respuestas-cerrar" onClick={onCerrar} aria-label="Cerrar">
            ×
          </button>
        </div>
        <p className="respuestas-ayuda">
          Frases para elegir con un clic al cancelar una venta. Si editas o eliminas una, las ventas ya canceladas
          conservan el texto que tenían.
        </p>

        {cargando && <p>Cargando...</p>}

        {!cargando && errorCarga && (
          <p className="error">
            No se pudieron cargar tus respuestas: {errorCarga}{' '}
            <button type="button" className="billete-rapido" onClick={() => setIntento((n) => n + 1)}>
              Reintentar
            </button>
          </p>
        )}

        {!cargando && !errorCarga && (
          <>
            {respuestas.length === 0 ? (
              <p className="respuestas-vacio">Todavía no tienes respuestas rápidas.</p>
            ) : (
              <ul className="respuestas-lista">
                {respuestas.map((r) => (
                  <li key={r.id} className="respuestas-item">
                    {editando?.id === r.id ? (
                      <form onSubmit={guardarEdicion} className="respuestas-form">
                        <label htmlFor={`editar-${r.id}`} className="respuestas-etiqueta">
                          Editar respuesta
                        </label>
                        <CampoRespuesta
                          id={`editar-${r.id}`}
                          valor={editando.texto}
                          onCambiar={(texto) => setEditando({ id: r.id, texto })}
                          autoFocus
                        />
                        <div className="respuestas-acciones">
                          <button type="submit" className="btn" disabled={enviando}>
                            Guardar
                          </button>
                          <button type="button" className="btn btn-secundario" onClick={() => setEditando(null)} disabled={enviando}>
                            Cancelar
                          </button>
                        </div>
                      </form>
                    ) : porEliminar === r.id ? (
                      <div className="respuestas-confirmar">
                        <p>¿Eliminar «{r.texto}»?</p>
                        <div className="respuestas-acciones">
                          <button type="button" className="btn btn-peligro" onClick={() => confirmarEliminar(r.id)} disabled={enviando}>
                            Sí, eliminar
                          </button>
                          <button type="button" className="btn btn-secundario" onClick={() => setPorEliminar(null)} disabled={enviando} autoFocus>
                            No
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <span className="respuestas-texto">{r.texto}</span>
                        <div className="respuestas-acciones">
                          <button
                            type="button"
                            className="btn btn-secundario"
                            onClick={() => {
                              setPorEliminar(null)
                              setError(null)
                              setEditando({ id: r.id, texto: r.texto })
                            }}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="btn btn-secundario"
                            onClick={() => {
                              setEditando(null)
                              setPorEliminar(r.id)
                            }}
                          >
                            Eliminar
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <p className="respuestas-cuenta">
              {respuestas.length} de {MAXIMO_RESPUESTAS} respuestas
            </p>

            {llegoAlMaximo ? (
              <p className="ayuda-mixto">Llegaste al máximo de {MAXIMO_RESPUESTAS}. Elimina una para agregar otra.</p>
            ) : (
              <form onSubmit={guardarNueva} className="respuestas-form">
                <label htmlFor="nueva-respuesta" className="respuestas-etiqueta">
                  Nueva respuesta
                </label>
                <CampoRespuesta id="nueva-respuesta" valor={nuevoTexto} onCambiar={setNuevoTexto} />
                <div className="respuestas-acciones">
                  <button type="submit" className="btn" disabled={enviando}>
                    Agregar
                  </button>
                </div>
              </form>
            )}
          </>
        )}

        {error && <p className="error">{error}</p>}
        {mensaje && <p className="mensaje-exito">{mensaje}</p>}
      </div>
    </div>
  )
}

export default MisRespuestasRapidas
