import { useCallback, useEffect, useState } from 'react'
import '../App.css'

const BASE_URL = import.meta.env.VITE_PAGOS_PROVEEDORES_API_BASE_URL || 'http://localhost:4006'
const API_URL = `${BASE_URL}/api/lotes-cierre`
// TDSI-22 / TDSI-122: endpoints para el microservicio de envíos a Contabilidad
const ENVIOS_URL = `${BASE_URL}/api/envios-contabilidad`
const reenviarUrl = (id) => `${ENVIOS_URL}/${id}/reenviar`

const fechaHoy = () => {
  const hoy = new Date()
  const offset = hoy.getTimezoneOffset()
  return new Date(hoy.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

const formatearMoneda = (valor) =>
  new Intl.NumberFormat('es-BO', {
    style: 'currency',
    currency: 'BOB',
    minimumFractionDigits: 2,
  }).format(Number(valor) || 0)

const obtenerMensajeError = (error) => {
  const status = error?.status ?? error?.response?.status
  if (status === 422) return 'Periodo contable cerrado'
  if (status === 503) return 'Contabilidad no disponible'
  if (status === 502) return 'Gestión de pagos no disponible'
  return error?.message || 'No se pudo completar la operación. Verifique su conexión e inténtelo nuevamente.'
}

// TDSI-22: normaliza el estado del envío a Enviado / Pendiente / Error
const ESTADOS_ENVIO = {
  ENVIADO: { etiqueta: 'Enviado', clase: 'envio-estado-enviado' },
  PENDIENTE: { etiqueta: 'Pendiente', clase: 'envio-estado-pendiente' },
  ERROR: { etiqueta: 'Error', clase: 'envio-estado-error' },
}

const normalizarEstadoEnvio = (valor) => {
  const v = String(valor || '').toUpperCase()
  if (['ENVIADO', 'ENVIADA', 'EXITO', 'OK'].includes(v)) return 'ENVIADO'
  if (['ERROR', 'FALLIDO', 'FALLIDA'].includes(v)) return 'ERROR'
  return 'PENDIENTE'
}

const idEnvio = (envio) => envio?.id ?? envio?.id_envio

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })

  let data = null
  try {
    data = await response.json()
  } catch {
    // Algunas respuestas de error pueden no traer JSON.
  }

  if (!response.ok) {
    const error = new Error(
      data?.mensaje || data?.message || data?.detalle?.mensaje || 'Ocurrió un error al comunicarse con el servidor.'
    )
    error.status = response.status
    error.data = data
    throw error
  }

  return data
}

export default function CierreDiario() {
  const [fecha, setFecha] = useState(fechaHoy)
  const [lote, setLote] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')
  const [loteExistente, setLoteExistente] = useState(null)
  const [modalExistente, setModalExistente] = useState(false)

  // TDSI-22: envíos a Contabilidad
  const [envios, setEnvios] = useState([])
  const [cargandoEnvios, setCargandoEnvios] = useState(false)
  const [errorEnvios, setErrorEnvios] = useState('')
  const [reenviandoId, setReenviandoId] = useState(null)
  const [mensajeEnvio, setMensajeEnvio] = useState(null) // { tipo: 'exito' | 'error', texto }

  const cargarEnvios = useCallback(async ({ silencioso = false } = {}) => {
    if (!silencioso) setCargandoEnvios(true)
    setErrorEnvios('')
    try {
      const res = await requestJson(ENVIOS_URL)
      const datos = res?.data ?? res
      const lista = Array.isArray(datos) ? datos : datos?.envios ?? []
      setEnvios(lista)
    } catch (err) {
      setErrorEnvios(obtenerMensajeError(err))
    } finally {
      setCargandoEnvios(false)
    }
  }, [])

  useEffect(() => {
    cargarEnvios()
  }, [cargarEnvios])

  const reenviarEnvio = async (envio) => {
    const id = idEnvio(envio)
    setReenviandoId(id)
    setMensajeEnvio(null)
    try {
      await requestJson(reenviarUrl(id), {
        method: 'POST',
        body: JSON.stringify({ solicitado_por: 'admin' }),
      })
      setMensajeEnvio({ tipo: 'exito', texto: `El envío #${id} fue reenviado a Contabilidad.` })
      // Refresca la lista para reflejar el nuevo estado
      await cargarEnvios({ silencioso: true })
    } catch (err) {
      setMensajeEnvio({ tipo: 'error', texto: `No se pudo reenviar el envío #${id}: ${obtenerMensajeError(err)}` })
    } finally {
      setReenviandoId(null)
    }
  }

  const verLoteExistente = async (loteRecibido) => {
    if (loteRecibido && typeof loteRecibido === 'object' && (loteRecibido.id != null || loteRecibido.id_lote != null)) {
      setLote(loteRecibido)
      setModalExistente(false)
      setError('')
      setExito('')
      return
    }

    setIsLoading(true)
    setError('')
    try {
      // El backend consulta por GET /:fecha
      const res = await requestJson(`${API_URL}/${fecha}`)
      const encontrado = res?.data ?? res
      if (!encontrado) {
        setError('El servidor indicó que existe un lote, pero no devolvió sus datos. Verifique el endpoint de consulta.')
        return
      }
      setLote(encontrado)
      setModalExistente(false)
    } catch (err) {
      setError(obtenerMensajeError(err))
    } finally {
      setIsLoading(false)
    }
  }

  const generarLote = async (event) => {
    event.preventDefault()
    setIsLoading(true)
    setError('')
    setExito('')
    setModalExistente(false)
    setLoteExistente(null)

    try {
      // El backend crea el lote con POST /
      const res = await requestJson(API_URL, {
        method: 'POST',
        body: JSON.stringify({ fecha, generado_por: 'admin' }),
      })

      const resultado = res?.data ?? res
      setLote(resultado)
      setExito('Lote de cierre diario generado correctamente.')
      // TDSI-22: el lote nuevo genera un envío a Contabilidad, refrescamos la tabla
      cargarEnvios({ silencioso: true })
    } catch (err) {
      // 409: La fecha ya tiene lote
      if (err.status === 409 || err.data?.existente || err.data?.yaExiste) {
        const existente = err.data?.detalle?.lote ?? err.data?.data ?? null
        setLoteExistente(existente)
        setModalExistente(true)
      } else {
        setError(obtenerMensajeError(err))
      }
    } finally {
      setIsLoading(false)
    }
  }

  const dinero = (valor) => formatearMoneda(valor)
  const estado = (lote?.estado || 'GENERADO').toUpperCase()

  return (
    <section className="cierre-diario">
      <header className="cierre-diario-header">
        <div className="cierre-diario-icono" aria-hidden="true">↻</div>
        <div>
          <p className="cierre-diario-eyebrow">ADMINISTRACIÓN / ENLACE ERP</p>
          <h1>Cierre diario</h1>
          <p className="cierre-diario-descripcion">Consolida los movimientos financieros del día y genera el lote para su integración con el ERP.</p>
        </div>
      </header>

      <section className="cierre-diario-panel" aria-labelledby="generar-lote-titulo">
        <div className="cierre-diario-panel-titulo">
          <div>
            <h2 id="generar-lote-titulo">Generación de lote</h2>
            <p>Selecciona la fecha contable que deseas procesar.</p>
          </div>
          <span className="cierre-diario-etiqueta">CIERRE DIARIO</span>
        </div>

        <form className="cierre-diario-form" onSubmit={generarLote}>
          <label className="campo cierre-diario-fecha">
            Fecha del cierre
            <input
              type="date"
              value={fecha}
              onChange={(event) => {
                setFecha(event.target.value)
                setError('')
                setExito('')
                setModalExistente(false)
              }}
              required
              aria-label="Fecha del cierre diario"
            />
          </label>
          <button className="btn cierre-diario-generar" type="submit" disabled={isLoading || !fecha}>
            {isLoading ? <><span className="cierre-diario-spinner" aria-hidden="true" /> Procesando...</> : 'Generar lote'}
          </button>
        </form>
      </section>

      {isLoading && (
        <section className="cierre-diario-panel" aria-live="polite" aria-label="Cargando lote">
          <div className="cierre-diario-skeleton cierre-diario-skeleton-titulo" />
          <div className="cierre-diario-metricas">
            {[1, 2, 3, 4].map((item) => <div className="cierre-diario-skeleton cierre-diario-skeleton-card" key={item} />)}
          </div>
          <p className="cierre-diario-ayuda">Consultando información del cierre...</p>
        </section>
      )}

      {error && (
        <div className="cierre-diario-alerta cierre-diario-alerta-error" role="alert">
          <span className="cierre-diario-alerta-icono" aria-hidden="true">!</span>
          <div>
            <strong>{error}</strong>
            {error === 'Periodo contable cerrado' && (
              <p>La generación fue bloqueada. Selecciona otra fecha con periodo contable abierto o contacta a Contabilidad.</p>
            )}
            {error === 'Contabilidad no disponible' && (
              <p>No se generó ningún lote. Inténtalo más tarde o contacta al equipo de soporte.</p>
            )}
          </div>
        </div>
      )}

      {exito && (
        <div className="cierre-diario-alerta cierre-diario-alerta-exito" role="status">
          <span aria-hidden="true">✓</span><strong>{exito}</strong>
        </div>
      )}

      {lote && !isLoading && (
        <section className="cierre-diario-panel cierre-diario-resultado" aria-labelledby="resumen-lote-titulo">
          <div className="cierre-diario-panel-titulo cierre-diario-resumen-titulo">
            <div>
              <p className="cierre-diario-eyebrow">RESULTADO DEL PROCESO</p>
              <h2 id="resumen-lote-titulo">Resumen financiero</h2>
              <p>Detalle consolidado del lote de cierre diario.</p>
            </div>
            <span className={`cierre-diario-estado ${estado === 'GENERADO' ? 'cierre-diario-estado-ok' : ''}`}>
              <span />{estado}
            </span>
          </div>

          <div className="cierre-diario-metadatos">
            <div><span>Fecha del lote</span><strong>{lote.fecha || fecha}</strong></div>
            <div><span>Identificador del lote</span><strong>{lote.id != null || lote.id_lote != null ? `#${lote.id ?? lote.id_lote}` : 'No informado'}</strong></div>
          </div>

          <div className="cierre-diario-metricas">
            <article className="cierre-diario-metrica metrica-ingresos">
              <span className="cierre-diario-metrica-icono" aria-hidden="true">↗</span>
              <span className="cierre-diario-metrica-label">Total ingresos</span>
              <strong>{dinero(lote.ingresos ?? lote.total_ingresos)}</strong>
              <small>Entradas consolidadas</small>
            </article>
            <article className="cierre-diario-metrica metrica-egresos">
              <span className="cierre-diario-metrica-icono" aria-hidden="true">↘</span>
              <span className="cierre-diario-metrica-label">Total egresos</span>
              <strong>{dinero(lote.egresos ?? lote.total_egresos)}</strong>
              <small>Salidas consolidadas</small>
            </article>
            <article className="cierre-diario-metrica metrica-impuestos">
              <span className="cierre-diario-metrica-icono" aria-hidden="true">%</span>
              <span className="cierre-diario-metrica-label">Total impuestos</span>
              <strong>{dinero(lote.impuestos ?? lote.total_impuestos)}</strong>
              <small>Impuestos del periodo</small>
            </article>
            <article className="cierre-diario-metrica metrica-neto">
              <span className="cierre-diario-metrica-icono" aria-hidden="true">＝</span>
              <span className="cierre-diario-metrica-label">Total neto</span>
              <strong>
                {dinero(
                  lote.neto ??
                  lote.total_neto ??
                  ((Number(lote.ingresos ?? lote.total_ingresos) || 0) - (Number(lote.egresos ?? lote.total_egresos) || 0))
                )}
              </strong>
              <small>Ingresos menos egresos</small>
            </article>
          </div>
          <p className="cierre-diario-nota"><span aria-hidden="true">i</span> Los importes se muestran en bolivianos (BOB).</p>
        </section>
      )}

      {/* TDSI-22: Envíos a Contabilidad */}
      <section className="cierre-diario-panel" aria-labelledby="envios-titulo">
        <div className="cierre-diario-panel-titulo">
          <div>
            <h2 id="envios-titulo">Envíos a Contabilidad</h2>
            <p>Reportes de ingresos, egresos e impuestos enviados para la creación de asientos contables.</p>
          </div>
          <button
            className="btn btn-secundario btn-pequeno"
            type="button"
            onClick={() => cargarEnvios()}
            disabled={cargandoEnvios || reenviandoId != null}
          >
            {cargandoEnvios ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>

        {mensajeEnvio && (
          <div
            className={`cierre-diario-alerta ${mensajeEnvio.tipo === 'exito' ? 'cierre-diario-alerta-exito' : 'cierre-diario-alerta-error'}`}
            role={mensajeEnvio.tipo === 'exito' ? 'status' : 'alert'}
          >
            <span aria-hidden="true">{mensajeEnvio.tipo === 'exito' ? '✓' : '!'}</span>
            <strong>{mensajeEnvio.texto}</strong>
          </div>
        )}

        {cargandoEnvios && envios.length === 0 && (
          <div aria-live="polite" aria-label="Cargando envíos">
            {[1, 2, 3].map((item) => <div className="cierre-diario-skeleton cierre-envios-skeleton" key={item} />)}
          </div>
        )}

        {errorEnvios && (
          <div className="cierre-diario-alerta cierre-diario-alerta-error" role="alert">
            <span className="cierre-diario-alerta-icono" aria-hidden="true">!</span>
            <div>
              <strong>No se pudieron cargar los envíos</strong>
              <p>{errorEnvios}</p>
            </div>
          </div>
        )}

        {!cargandoEnvios && !errorEnvios && envios.length === 0 && (
          <div className="cierre-envios-vacio">
            <strong>Sin envíos registrados</strong>
            <p>Cuando se genere un lote de cierre, su envío a Contabilidad aparecerá aquí.</p>
          </div>
        )}

        {envios.length > 0 && (
          <div className="cierre-envios-tabla-contenedor">
            <table className="cierre-envios-tabla">
              <thead>
                <tr>
                  <th>Envío</th>
                  <th>Lote</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {envios.map((envio, indice) => {
                  const id = idEnvio(envio)
                  const clave = normalizarEstadoEnvio(envio.estado)
                  const { etiqueta, clase } = ESTADOS_ENVIO[clave]
                  const idLote = envio.id_lote ?? envio.lote_id
                  const fechaEnvio = envio.fecha ?? envio.fecha_lote ?? envio.fecha_envio
                  const reenviando = reenviandoId === id

                  return (
                    <tr key={id ?? indice}>
                      <td>{id != null ? `#${id}` : '—'}</td>
                      <td>{idLote != null ? `#${idLote}` : '—'}</td>
                      <td>{fechaEnvio ? String(fechaEnvio).slice(0, 10) : '—'}</td>
                      <td>
                        <span className={`envio-estado ${clase}`}>
                          <span aria-hidden="true" />{etiqueta}
                        </span>
                        {clave === 'ERROR' && envio.mensaje_error && (
                          <small className="envio-detalle-error">{envio.mensaje_error}</small>
                        )}
                      </td>
                      <td className="cierre-envios-acciones">
                        {clave === 'ERROR' && (
                          <button
                            className="btn btn-secundario btn-pequeno"
                            type="button"
                            onClick={() => reenviarEnvio(envio)}
                            disabled={reenviandoId != null}
                          >
                            {reenviando ? 'Reenviando...' : 'Reenviar'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modalExistente && (
        <div className="cierre-diario-modal-fondo" role="presentation">
          <section className="cierre-diario-modal" role="dialog" aria-modal="true" aria-labelledby="lote-existente-titulo">
            <div className="cierre-diario-modal-icono" aria-hidden="true">i</div>
            <h2 id="lote-existente-titulo">Ya existe un lote generado para esta fecha</h2>
            <p>La fecha seleccionada ya fue procesada. Puedes consultar el lote registrado sin generar uno nuevo.</p>
            <div className="cierre-diario-modal-acciones">
              <button className="btn btn-secundario" type="button" onClick={() => setModalExistente(false)}>Cancelar</button>
              <button className="btn" type="button" onClick={() => verLoteExistente(loteExistente)} disabled={isLoading}>
                {isLoading ? 'Consultando...' : 'Ver lote existente'}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}