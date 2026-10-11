import { useState } from 'react'
import '../App.css'

const API_URL = '/api/lotes-cierre'

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
  return error?.message || 'No se pudo completar la operación. Verifique su conexión e inténtelo nuevamente.'
}

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
    const error = new Error(data?.mensaje || data?.message || 'Ocurrió un error al comunicarse con el servidor.')
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

  const verLoteExistente = async (loteRecibido) => {
    if (loteRecibido && typeof loteRecibido === 'object' && loteRecibido.id != null) {
      setLote(loteRecibido)
      setModalExistente(false)
      setError('')
      setExito('')
      return
    }

    setIsLoading(true)
    setError('')
    try {
      const data = await requestJson(`${API_URL}?fecha=${encodeURIComponent(fecha)}`)
      const encontrado = data?.lote ?? data
      if (!encontrado || encontrado.id == null) {
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
      const data = await requestJson(`${API_URL}/generar`, {
        method: 'POST',
        body: JSON.stringify({ fecha }),
      })

      const resultado = data?.lote ?? data
      if (data?.existente || data?.yaExiste) {
        setLoteExistente(data?.lote ?? data?.loteExistente ?? null)
        setModalExistente(true)
        return
      }

      setLote(resultado)
      setExito('Lote de cierre diario generado correctamente.')
    } catch (err) {
      if (err.status === 409 || err.data?.existente || err.data?.yaExiste) {
        setLoteExistente(err.data?.lote ?? err.data?.loteExistente ?? null)
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
        <p className="cierre-diario-ayuda">Antes de generar el lote se valida que el periodo contable esté abierto.</p>
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
          <div><strong>{error}</strong>{error === 'Periodo contable cerrado' && <p>La generación fue bloqueada. Selecciona otra fecha con periodo contable abierto o contacta a Contabilidad.</p>}{error === 'Contabilidad no disponible' && <p>No se generó ningún lote. Inténtalo más tarde o contacta al equipo de soporte.</p>}</div>
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
            <span className={`cierre-diario-estado ${estado === 'GENERADO' ? 'cierre-diario-estado-ok' : ''}`}><span />{estado}</span>
          </div>

          <div className="cierre-diario-metadatos">
            <div><span>Fecha del lote</span><strong>{lote.fecha || fecha}</strong></div>
            <div><span>Identificador del lote</span><strong>{lote.id != null ? `#${lote.id}` : 'No informado'}</strong></div>
          </div>

          <div className="cierre-diario-metricas">
            <article className="cierre-diario-metrica metrica-ingresos">
              <span className="cierre-diario-metrica-icono" aria-hidden="true">↗</span>
              <span className="cierre-diario-metrica-label">Total ingresos</span>
              <strong>{dinero(lote.ingresos)}</strong>
              <small>Entradas consolidadas</small>
            </article>
            <article className="cierre-diario-metrica metrica-egresos">
              <span className="cierre-diario-metrica-icono" aria-hidden="true">↘</span>
              <span className="cierre-diario-metrica-label">Total egresos</span>
              <strong>{dinero(lote.egresos)}</strong>
              <small>Salidas consolidadas</small>
            </article>
            <article className="cierre-diario-metrica metrica-impuestos">
              <span className="cierre-diario-metrica-icono" aria-hidden="true">%</span>
              <span className="cierre-diario-metrica-label">Total impuestos</span>
              <strong>{dinero(lote.impuestos)}</strong>
              <small>Impuestos del periodo</small>
            </article>
            <article className="cierre-diario-metrica metrica-neto">
              <span className="cierre-diario-metrica-icono" aria-hidden="true">＝</span>
              <span className="cierre-diario-metrica-label">Total neto</span>
              <strong>{dinero(lote.neto ?? ((Number(lote.ingresos) || 0) - (Number(lote.egresos) || 0)))}</strong>
              <small>Ingresos menos egresos</small>
            </article>
          </div>
          <p className="cierre-diario-nota"><span aria-hidden="true">i</span> Los importes se muestran en bolivianos (BOB).</p>
        </section>
      )}

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
