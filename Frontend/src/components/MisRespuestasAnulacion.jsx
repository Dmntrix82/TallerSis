import { useEffect, useState } from 'react'
import {
  listarRespuestasAnulacion,
  crearRespuestaAnulacion,
  editarRespuestaAnulacion,
  eliminarRespuestaAnulacion,
  validarMotivoAnulacion,
  MAXIMO_RESPUESTAS_ANULACION,
  LARGO_MAXIMO_ANULACION,
} from '../api/respuestasAnulacion.js'

// Las clases respuestas-* son las del panel de TDSI-44 (mismo enfoque y mismo aspecto).

function CampoRespuesta({ id, valor, onCambiar, autoFocus }) {
  return (
    <>
      <textarea
        id={id}
        rows={2}
        maxLength={LARGO_MAXIMO_ANULACION}
        value={valor}
        autoFocus={autoFocus}
        onChange={(e) => onCambiar(e.target.value)}
      />
      <span className="respuestas-contador">
        {valor.trim().length}/{LARGO_MAXIMO_ANULACION}
      </span>
    </>
  )
}

// TDSI-174: panel "Mis respuestas de anulación" del cajero, con el formulario "Nueva respuesta"
// (TDSI-894), edición y "Eliminar" con confirmación (TDSI-895). Cada cajero ve solo las suyas.
function PanelRespuestasAnulacion({ cajeroId, onCerrar }) {
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
    listarRespuestasAnulacion(cajeroId)
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

  const llegoAlMaximo = respuestas.length >= MAXIMO_RESPUESTAS_ANULACION

  function avisar(texto) {
    setError(null)
    setMensaje(texto)
  }

  function fallar(texto) {
    setMensaje(null)
    setError(texto)
  }

  async function guardarNueva(event) {
    event.preventDefault()
    const errorTexto = validarMotivoAnulacion(nuevoTexto)
    if (errorTexto) return fallar(errorTexto)
    if (llegoAlMaximo) return

    setEnviando(true)
    setError(null)
    try {
      // El backend guarda "orden" pero no lo calcula: se deja al final de la lista.
      const orden = Math.max(0, ...respuestas.map((r) => r.orden)) + 1
      const { data } = await crearRespuestaAnulacion({ cajero_id: cajeroId, texto: nuevoTexto.trim(), orden })
      setRespuestas((prev) => [...prev, data])
      setNuevoTexto('')
      avisar('Respuesta guardada.')
    } catch (err) {
      fallar(err.message)
    } finally {
      setEnviando(false)
    }
  }

  async function guardarEdicion(event) {
    event.preventDefault()
    const errorTexto = validarMotivoAnulacion(editando.texto)
    if (errorTexto) return fallar(errorTexto)

    setEnviando(true)
    setError(null)
    try {
      const { data } = await editarRespuestaAnulacion(editando.id, { cajero_id: cajeroId, texto: editando.texto.trim() })
      setRespuestas((prev) => prev.map((r) => (r.id === data.id ? data : r)))
      setEditando(null)
      avisar('Respuesta actualizada.')
    } catch (err) {
      fallar(err.message)
    } finally {
      setEnviando(false)
    }
  }

  async function confirmarEliminar(id) {
    setEnviando(true)
    setError(null)
    try {
      await eliminarRespuestaAnulacion(id, cajeroId)
      setRespuestas((prev) => prev.filter((r) => r.id !== id))
      setPorEliminar(null)
      avisar('Respuesta eliminada.')
    } catch (err) {
      fallar(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-caja respuestas-panel" role="dialog" aria-modal="true" aria-labelledby="titulo-respuestas-anulacion">
        <div className="respuestas-encabezado">
          <h2 id="titulo-respuestas-anulacion">Mis respuestas de anulación</h2>
          <button type="button" className="respuestas-cerrar" onClick={onCerrar} aria-label="Cerrar">
            ×
          </button>
        </div>
        <p className="respuestas-ayuda">
          Motivos para elegir con un clic al anular una factura. Si editas o eliminas uno, las facturas ya anuladas
          conservan el motivo que tenían.
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
              <p className="respuestas-vacio">Todavía no tienes respuestas de anulación.</p>
            ) : (
              <ul className="respuestas-lista">
                {respuestas.map((r) => (
                  <li key={r.id} className="respuestas-item">
                    {editando?.id === r.id ? (
                      <form onSubmit={guardarEdicion} className="respuestas-form">
                        <label htmlFor={`editar-anulacion-${r.id}`} className="respuestas-etiqueta">
                          Editar respuesta
                        </label>
                        <CampoRespuesta
                          id={`editar-anulacion-${r.id}`}
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
              {respuestas.length} de {MAXIMO_RESPUESTAS_ANULACION} respuestas
            </p>

            {llegoAlMaximo ? (
              <p className="ayuda-mixto">Llegaste al máximo de {MAXIMO_RESPUESTAS_ANULACION}. Elimina una para agregar otra.</p>
            ) : (
              <form onSubmit={guardarNueva} className="respuestas-form">
                <label htmlFor="nueva-respuesta-anulacion" className="respuestas-etiqueta">
                  Nueva respuesta
                </label>
                <CampoRespuesta id="nueva-respuesta-anulacion" valor={nuevoTexto} onCambiar={setNuevoTexto} />
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

// Botón de la pantalla Facturas que abre el panel. Lleva su propio estado para que Facturas
// solo tenga que mostrarlo.
function MisRespuestasAnulacion({ cajeroId }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <button type="button" className="btn btn-secundario" onClick={() => setAbierto(true)}>
        Mis respuestas de anulación
      </button>
      {abierto && <PanelRespuestasAnulacion cajeroId={cajeroId} onCerrar={() => setAbierto(false)} />}
    </>
  )
}

export default MisRespuestasAnulacion
