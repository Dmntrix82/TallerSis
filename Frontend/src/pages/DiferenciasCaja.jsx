import { useEffect, useMemo, useState } from 'react'
import { listarDiferencias, resolverDiferencia, reenviarDiferenciaContabilidad } from '../api/caja.js'
import { useAdminAuth } from '../context/AdminAuthContext.jsx'

const ETIQUETA_TIPO = { FALTANTE: 'Faltante', SOBRANTE: 'Sobrante' }

const FILTROS_ESTADO = [
  { valor: '', etiqueta: 'Todas' },
  { valor: 'PENDIENTE', etiqueta: 'Pendientes' },
  { valor: 'RESUELTA', etiqueta: 'Resueltas' },
]

// "SinEnviar" = resuelta pero Contabilidad todavia no confirmo nada publicado con exito
// (el envio quedo en Pendiente por un error al publicar).
const FILTROS_CONTABILIDAD = [
  { valor: '', etiqueta: 'Todos' },
  { valor: 'Error', etiqueta: 'Error al enviar' },
  { valor: 'Enviado', etiqueta: 'Enviado' },
  { valor: 'Confirmado', etiqueta: 'Confirmado' },
  { valor: 'Rechazado', etiqueta: 'Rechazado' },
]

// TDSI-52: a partir del estado crudo del envio (y si tiene ultimo_error) se arma lo
// que el Administrador necesita ver: una etiqueta visual + si corresponde "Reenviar".
function estadoContabilidad(contabilidad) {
  if (!contabilidad) return null
  const esError = contabilidad.estado === 'Pendiente' && contabilidad.ultimo_error
  return {
    etiqueta: esError ? 'Error' : contabilidad.estado,
    clase: esError || contabilidad.estado === 'Rechazado' ? 'badge-comparacion--faltante' : contabilidad.estado === 'Confirmado' ? 'badge-comparacion--cuadra' : 'badge-estado',
    motivo: esError ? contabilidad.ultimo_error : contabilidad.motivo_rechazo,
    puedeReenviar: contabilidad.estado === 'Pendiente' || contabilidad.estado === 'Rechazado',
    filtroValor: esError ? 'Error' : contabilidad.estado,
  }
}

function DiferenciasCaja() {
  const { administrador } = useAdminAuth()

  const [diferencias, setDiferencias] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [recargar, setRecargar] = useState(0)

  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroContabilidad, setFiltroContabilidad] = useState('')

  const [mensaje, setMensaje] = useState(null) // { ok, texto } | null

  const [seleccionada, setSeleccionada] = useState(null)
  const [justificacion, setJustificacion] = useState('')
  const [resolviendo, setResolviendo] = useState(false)
  const [errorResolver, setErrorResolver] = useState(null)

  const [reenviandoId, setReenviandoId] = useState(null)
  const [errorReenviar, setErrorReenviar] = useState(null) // { id, mensaje } | null

  useEffect(() => {
    let vigente = true
    setCargando(true)
    setError(null)
    listarDiferencias({ estado: filtroEstado || undefined })
      .then((r) => vigente && setDiferencias(r.data))
      .catch((err) => vigente && setError(err.mensaje || err.message))
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [filtroEstado, recargar])

  const diferenciasFiltradas = useMemo(() => {
    if (!filtroContabilidad) return diferencias
    return diferencias.filter((d) => estadoContabilidad(d.contabilidad)?.filtroValor === filtroContabilidad)
  }, [diferencias, filtroContabilidad])

  function abrirResolver(diferencia) {
    setSeleccionada(diferencia)
    setJustificacion('')
    setErrorResolver(null)
    setMensaje(null)
  }

  function cerrarResolver() {
    setSeleccionada(null)
  }

  async function confirmarResolver(event) {
    event.preventDefault()
    if (!justificacion.trim()) {
      setErrorResolver('La justificación es obligatoria.')
      return
    }
    setResolviendo(true)
    setErrorResolver(null)
    try {
      const { data } = await resolverDiferencia(seleccionada.id, {
        justificacion: justificacion.trim(),
        resuelta_por: administrador?.nombre,
      })
      setMensaje({
        ok: true,
        texto: data.contabilidad?.publicado
          ? 'Diferencia resuelta y enviada a Contabilidad.'
          : 'Diferencia resuelta, pero no se pudo enviar a Contabilidad todavía (podés reintentarlo con "Reenviar").',
      })
      setSeleccionada(null)
      setRecargar((n) => n + 1)
    } catch (err) {
      setErrorResolver(err.mensaje || err.message)
    } finally {
      setResolviendo(false)
    }
  }

  async function reenviar(id) {
    setReenviandoId(id)
    setErrorReenviar(null)
    try {
      await reenviarDiferenciaContabilidad(id)
      setMensaje({ ok: true, texto: 'Reenviado a Contabilidad.' })
      setRecargar((n) => n + 1)
    } catch (err) {
      setErrorReenviar({ id, mensaje: err.mensaje || err.message })
    } finally {
      setReenviandoId(null)
    }
  }

  return (
    <section className="diferencias-caja">
      <h1>Diferencias de caja</h1>
      <p className="resumen-turno-actual">
        Faltantes y sobrantes detectados al cerrar turnos, y el aviso enviado a Contabilidad al resolverlos.
      </p>

      <div className="filtro-fechas">
        <label className="campo campo-turno-dia">
          Estado
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
            {FILTROS_ESTADO.map((o) => (
              <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
            ))}
          </select>
        </label>
        <label className="campo campo-turno-dia">
          Contabilidad
          <select value={filtroContabilidad} onChange={(e) => setFiltroContabilidad(e.target.value)}>
            {FILTROS_CONTABILIDAD.map((o) => (
              <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
            ))}
          </select>
        </label>
      </div>

      {mensaje && <p className={mensaje.ok ? 'mensaje-exito' : 'error'}>{mensaje.texto}</p>}

      {cargando && <p>Cargando...</p>}
      {!cargando && error && <p className="error">Error: {error}</p>}

      {!cargando && !error && diferenciasFiltradas.length === 0 && (
        <p className="orden-mensaje orden-mensaje-pendiente cajas-mensaje">No hay diferencias que coincidan con los filtros.</p>
      )}

      {!cargando && !error && diferenciasFiltradas.length > 0 && (
        <div className="reporte-tabla">
          <table className="tabla-facturas">
            <thead>
              <tr>
                <th>Turno</th>
                <th>Caja</th>
                <th>Cajero</th>
                <th>Tipo</th>
                <th>Monto (Bs.)</th>
                <th>Estado</th>
                <th>Justificación</th>
                <th>Contabilidad</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {diferenciasFiltradas.map((d) => {
                const contab = estadoContabilidad(d.contabilidad)
                return (
                  <tr key={d.id}>
                    <td>{d.turno_id}</td>
                    <td>{d.caja_id}</td>
                    <td>{d.cajero || '—'}</td>
                    <td>
                      <span className={`badge-estado badge-diferencia--${d.tipo?.toLowerCase()}`}>
                        {ETIQUETA_TIPO[d.tipo] ?? d.tipo}
                      </span>
                    </td>
                    <td className={`diferencia-monto--${d.tipo?.toLowerCase()}`}>{Math.abs(d.monto).toFixed(2)}</td>
                    <td>
                      <span className={`badge-estado ${d.estado === 'RESUELTA' ? 'badge-estado--emitida' : ''}`}>
                        {d.estado === 'RESUELTA' ? 'Resuelta' : 'Pendiente'}
                      </span>
                    </td>
                    <td>{d.justificacion || '—'}</td>
                    <td>
                      {contab ? (
                        <>
                          <span className={`badge-estado ${contab.clase}`} title={contab.motivo || ''}>
                            {contab.etiqueta}
                          </span>
                          {contab.puedeReenviar && (
                            <div style={{ marginTop: '0.35rem' }}>
                              <button
                                type="button"
                                className="btn btn-secundario btn-pequeno"
                                onClick={() => reenviar(d.id)}
                                disabled={reenviandoId === d.id}
                              >
                                {reenviandoId === d.id ? 'Reenviando...' : 'Reenviar'}
                              </button>
                              {errorReenviar?.id === d.id && (
                                <p className="error" style={{ fontSize: '0.75rem', margin: '0.25rem 0 0' }}>{errorReenviar.mensaje}</p>
                              )}
                            </div>
                          )}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {d.estado === 'PENDIENTE' && (
                        <button type="button" className="btn" onClick={() => abrirResolver(d)}>
                          Resolver
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

      {seleccionada && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Resolver diferencia">
          <form className="modal-caja" onSubmit={confirmarResolver}>
            <h2>Resolver diferencia</h2>
            <p>
              Turno {seleccionada.turno_id} · {seleccionada.caja_id} ·{' '}
              <strong className={`diferencia-monto--${seleccionada.tipo?.toLowerCase()}`}>
                {ETIQUETA_TIPO[seleccionada.tipo] ?? seleccionada.tipo}: Bs. {Math.abs(seleccionada.monto).toFixed(2)}
              </strong>
            </p>

            <label className="campo">
              Justificación
              <textarea
                rows={4}
                value={justificacion}
                onChange={(e) => {
                  setJustificacion(e.target.value)
                  setErrorResolver(null)
                }}
                autoFocus
              />
            </label>

            {errorResolver && <p className="error">{errorResolver}</p>}

            <div className="pago-exito-acciones">
              <button type="button" className="btn btn-secundario" onClick={cerrarResolver} disabled={resolviendo}>
                Cancelar
              </button>
              <button type="submit" className="btn" disabled={resolviendo}>
                {resolviendo ? 'Resolviendo...' : 'Resolver'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}

export default DiferenciasCaja
