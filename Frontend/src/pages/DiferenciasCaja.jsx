import { useEffect, useState } from 'react'
import { listarCajas, listarDiferencias, resolverDiferencia } from '../api/caja.js'
import { useAdminAuth } from '../context/AdminAuthContext.jsx'
import ResolverDiferenciaModal from '../components/ResolverDiferenciaModal.jsx'

// TDSI-142 / TDSI-519: vista "Diferencias de caja" con los faltantes y sobrantes pendientes.
// TDSI-520: formulario para justificar y resolver una diferencia.
// TDSI-521: filtros por estado, tipo y caja (se mandan al backend).
// TDSI-522: mensajes de confirmacion, validacion (justificacion obligatoria) y error.
//
// Datos: GET /api/caja/diferencias y POST /api/caja/diferencias/:id/resolver (gestion_caja).
// Las diferencias se registran solas al cerrar un turno con faltante o sobrante.

const ETIQUETA_TIPO = { FALTANTE: 'Faltante', SOBRANTE: 'Sobrante' }
const ETIQUETA_ESTADO = { PENDIENTE: 'Pendiente', RESUELTA: 'Resuelta' }

function DiferenciasCaja() {
  const { administrador } = useAdminAuth()

  const [filtroEstado, setFiltroEstado] = useState('PENDIENTE')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroCaja, setFiltroCaja] = useState('')

  const [cajas, setCajas] = useState([])
  const [diferencias, setDiferencias] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [mensaje, setMensaje] = useState(null)
  const [aResolver, setAResolver] = useState(null)
  const [recargar, setRecargar] = useState(0)

  useEffect(() => {
    listarCajas()
      .then((r) => setCajas(r.data))
      .catch(() => setCajas([]))
  }, [])

  useEffect(() => {
    let vigente = true
    setCargando(true)
    setError(null)
    listarDiferencias({ estado: filtroEstado, tipo: filtroTipo, caja_id: filtroCaja })
      .then((r) => vigente && setDiferencias(r.data))
      .catch((err) => vigente && setError(err.mensaje || err.message))
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [filtroEstado, filtroTipo, filtroCaja, recargar])

  function cambiarFiltro(setter) {
    return (e) => {
      setMensaje(null)
      setter(e.target.value)
    }
  }

  // Lo llama el formulario; si lanza error, el formulario lo muestra y no se cierra.
  // La diferencia resuelta se queda en la lista con su nuevo estado hasta que se actualice.
  async function confirmarResolucion(datos) {
    const { data } = await resolverDiferencia(aResolver.id, datos)
    setDiferencias((prev) => prev.map((d) => (d.id === data.id ? { ...d, ...data } : d)))
    setMensaje(`Diferencia de ${aResolver.caja_id} (turno ${aResolver.turno_id}) marcada como resuelta.`)
    setAResolver(null)
  }

  const hayFiltros = filtroEstado !== 'PENDIENTE' || filtroTipo || filtroCaja

  return (
    <section>
      <h1>Diferencias de caja</h1>
      <p className="resumen-turno-actual">
        Faltantes y sobrantes detectados al cerrar turnos. Justifique cada uno para darlo por resuelto.
      </p>

      <div className="filtro-fechas">
        <label className="campo">
          Estado
          <select value={filtroEstado} onChange={cambiarFiltro(setFiltroEstado)}>
            <option value="PENDIENTE">Pendientes</option>
            <option value="RESUELTA">Resueltas</option>
            <option value="">Todas</option>
          </select>
        </label>
        <label className="campo">
          Tipo
          <select value={filtroTipo} onChange={cambiarFiltro(setFiltroTipo)}>
            <option value="">Todos</option>
            <option value="FALTANTE">Faltantes</option>
            <option value="SOBRANTE">Sobrantes</option>
          </select>
        </label>
        <label className="campo">
          Caja
          <select value={filtroCaja} onChange={cambiarFiltro(setFiltroCaja)}>
            <option value="">Todas</option>
            {cajas.map((c) => (
              <option key={c.codigo} value={c.codigo}>
                {c.nombre ? `${c.codigo} · ${c.nombre}` : c.codigo}
              </option>
            ))}
          </select>
        </label>
        {hayFiltros && (
          <button
            type="button"
            className="btn btn-secundario"
            onClick={() => {
              setMensaje(null)
              setFiltroEstado('PENDIENTE')
              setFiltroTipo('')
              setFiltroCaja('')
            }}
          >
            Quitar filtros
          </button>
        )}
      </div>

      {mensaje && <p className="mensaje-exito solicitudes-mensaje">{mensaje}</p>}

      {cargando && <p>Cargando...</p>}

      {!cargando && error && (
        <div className="orden-mensaje orden-mensaje-error cajas-mensaje">
          <span>No se pudieron cargar las diferencias: {error}</span>
          <button type="button" className="btn btn-secundario" onClick={() => setRecargar((n) => n + 1)}>
            Reintentar
          </button>
        </div>
      )}

      {!cargando && !error && diferencias.length === 0 && (
        <p className="orden-mensaje orden-mensaje-pendiente cajas-mensaje">
          {filtroEstado === 'PENDIENTE' && !filtroTipo && !filtroCaja
            ? 'No hay diferencias pendientes de resolver.'
            : 'No hay diferencias que coincidan con los filtros.'}
        </p>
      )}

      {!cargando && !error && diferencias.length > 0 && (
        <table className="tabla-facturas">
          <thead>
            <tr>
              <th>Caja</th>
              <th>Turno</th>
              <th>Tipo</th>
              <th>Monto (Bs.)</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {diferencias.map((d) => {
              const tipo = d.tipo.toLowerCase()
              return (
                <tr key={d.id}>
                  <td>{d.caja_id}</td>
                  <td>{d.turno_id}</td>
                  <td>
                    <span className={`badge-estado badge-diferencia--${tipo}`}>{ETIQUETA_TIPO[d.tipo] ?? d.tipo}</span>
                  </td>
                  <td className={`diferencia-monto--${tipo}`}>{Math.abs(d.monto).toFixed(2)}</td>
                  <td>
                    <span className={`badge-estado${d.estado === 'RESUELTA' ? ' badge-estado--emitida' : ''}`}>
                      {ETIQUETA_ESTADO[d.estado] ?? d.estado}
                    </span>
                    {d.estado === 'RESUELTA' && (
                      <>
                        <span className="solicitud-detalle">
                          Por {d.resuelta_por}
                          {d.resuelta_en && ` · ${new Date(d.resuelta_en).toLocaleString()}`}
                        </span>
                        {d.justificacion && <span className="solicitud-detalle">{d.justificacion}</span>}
                      </>
                    )}
                  </td>
                  <td>
                    {d.estado === 'PENDIENTE' && (
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          setMensaje(null)
                          setAResolver(d)
                        }}
                      >
                        Resolver
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {aResolver && (
        <ResolverDiferenciaModal
          diferencia={aResolver}
          responsableInicial={administrador?.nombre}
          onConfirmar={confirmarResolucion}
          onCancelar={() => setAResolver(null)}
        />
      )}
    </section>
  )
}

export default DiferenciasCaja
