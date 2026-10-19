import { useEffect, useState } from 'react'
import {
  listarTiposOperacion,
  listarOperaciones,
  aprobarOperacion,
  rechazarOperacion,
} from '../api/aprobaciones.js'
import DecisionOperacionModal from '../components/DecisionOperacionModal.jsx'

// TDSI-148 / TDSI-507: bandeja "Operaciones que requieren aprobación" con tipo, descripcion y solicitante.
// TDSI-508: botones Aprobar y Rechazar (con motivo).
// TDSI-509: filtros por estado y tipo (se mandan al backend).
// TDSI-510: mensajes de confirmacion, validacion y error.
//
// Datos: /api/caja/aprobaciones (gestion_caja). Las pendientes vienen primero.

const ETIQUETA_ESTADO = {
  PENDIENTE: 'Pendiente',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
}

function OperacionesAprobacion() {
  const [filtroEstado, setFiltroEstado] = useState('PENDIENTE')
  const [filtroTipo, setFiltroTipo] = useState('')

  const [tipos, setTipos] = useState([]) // [{ codigo, descripcion }]
  const [operaciones, setOperaciones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [mensaje, setMensaje] = useState(null)
  const [decision, setDecision] = useState(null) // { operacion, accion: 'APROBAR' | 'RECHAZAR' }
  const [recargar, setRecargar] = useState(0)

  useEffect(() => {
    listarTiposOperacion()
      .then((r) => setTipos(r.data))
      .catch(() => setTipos([]))
  }, [])

  useEffect(() => {
    let vigente = true
    setCargando(true)
    setError(null)
    listarOperaciones({ estado: filtroEstado, tipo: filtroTipo })
      .then((r) => vigente && setOperaciones(r.data))
      .catch((err) => vigente && setError(err.mensaje || err.message))
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [filtroEstado, filtroTipo, recargar])

  function etiquetaTipo(codigo) {
    return tipos.find((t) => t.codigo === codigo)?.descripcion ?? codigo
  }

  function cambiarFiltro(setter) {
    return (e) => {
      setMensaje(null)
      setter(e.target.value)
    }
  }

  function actualizarBandeja() {
    setMensaje(null)
    setRecargar((n) => n + 1)
  }

  // Lo llama el formulario; si lanza error, el formulario lo muestra y no se cierra.
  // La operacion resuelta se queda en la lista con su nuevo estado hasta que se actualice.
  async function confirmarDecision(credenciales) {
    const { operacion, accion } = decision
    const { data } =
      accion === 'APROBAR'
        ? await aprobarOperacion(operacion.id, credenciales)
        : await rechazarOperacion(operacion.id, credenciales)

    setOperaciones((prev) => prev.map((o) => (o.id === data.id ? { ...o, ...data } : o)))
    setMensaje(
      accion === 'APROBAR'
        ? `Operación aprobada: ${etiquetaTipo(operacion.tipo)} en ${operacion.caja_id}.`
        : `Operación rechazada: ${etiquetaTipo(operacion.tipo)} en ${operacion.caja_id}.`
    )
    setDecision(null)
  }

  const pendientes = operaciones.filter((o) => o.estado === 'PENDIENTE').length
  const hayFiltros = filtroEstado !== 'PENDIENTE' || filtroTipo

  return (
    <section>
      <h1>Operaciones que requieren aprobación</h1>
      <p className="resumen-turno-actual">
        Operaciones de caja que un cajero pidió y necesitan la autorización de un supervisor.
      </p>

      <div className="filtro-fechas">
        <label className="campo">
          Estado
          <select value={filtroEstado} onChange={cambiarFiltro(setFiltroEstado)}>
            <option value="PENDIENTE">Pendientes</option>
            <option value="APROBADA">Aprobadas</option>
            <option value="RECHAZADA">Rechazadas</option>
            <option value="">Todas</option>
          </select>
        </label>
        <label className="campo">
          Tipo
          <select value={filtroTipo} onChange={cambiarFiltro(setFiltroTipo)}>
            <option value="">Todos</option>
            {tipos.map((t) => (
              <option key={t.codigo} value={t.codigo}>{t.descripcion}</option>
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
            }}
          >
            Quitar filtros
          </button>
        )}
      </div>

      <div className="solicitudes-barra">
        {!cargando && !error && (
          <span className="solicitudes-contador">
            {pendientes === 1 ? '1 operación pendiente' : `${pendientes} operaciones pendientes`}
          </span>
        )}
        <button type="button" className="btn btn-secundario" onClick={actualizarBandeja} disabled={cargando}>
          Actualizar
        </button>
      </div>

      {mensaje && <p className="mensaje-exito solicitudes-mensaje">{mensaje}</p>}

      {cargando && <p>Cargando...</p>}

      {!cargando && error && (
        <div className="orden-mensaje orden-mensaje-error cajas-mensaje">
          <span>No se pudieron cargar las operaciones: {error}</span>
          <button type="button" className="btn btn-secundario" onClick={actualizarBandeja}>
            Reintentar
          </button>
        </div>
      )}

      {!cargando && !error && operaciones.length === 0 && (
        <p className="orden-mensaje orden-mensaje-pendiente cajas-mensaje">
          {hayFiltros
            ? 'No hay operaciones que coincidan con los filtros.'
            : 'No hay operaciones pendientes de aprobación.'}
        </p>
      )}

      {!cargando && !error && operaciones.length > 0 && (
        <table className="tabla-facturas">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Descripción</th>
              <th>Solicitante</th>
              <th>Fecha</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {operaciones.map((o) => (
              <tr key={o.id}>
                <td>
                  {etiquetaTipo(o.tipo)}
                  <span className="solicitud-detalle">{o.caja_id}</span>
                </td>
                <td>
                  {o.descripcion}
                  {o.monto != null && <span className="solicitud-detalle">Monto: Bs. {o.monto.toFixed(2)}</span>}
                </td>
                <td>{o.solicitado_por_nombre || o.solicitado_por}</td>
                <td>{new Date(o.creado_en).toLocaleString()}</td>
                <td>
                  <span className={`badge-estado badge-solicitud--${o.estado.toLowerCase()}`}>
                    {ETIQUETA_ESTADO[o.estado] ?? o.estado}
                  </span>
                  {o.estado !== 'PENDIENTE' && (
                    <span className="solicitud-detalle">
                      Por {o.autorizado_por_nombre || o.autorizado_por}
                      {o.resuelto_en && ` · ${new Date(o.resuelto_en).toLocaleString()}`}
                    </span>
                  )}
                  {o.motivo && <span className="solicitud-detalle">Motivo: {o.motivo}</span>}
                </td>
                <td>
                  {o.estado === 'PENDIENTE' && (
                    <div className="solicitud-acciones">
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          setMensaje(null)
                          setDecision({ operacion: o, accion: 'APROBAR' })
                        }}
                      >
                        Aprobar
                      </button>
                      <button
                        type="button"
                        className="btn btn-peligro"
                        onClick={() => {
                          setMensaje(null)
                          setDecision({ operacion: o, accion: 'RECHAZAR' })
                        }}
                      >
                        Rechazar
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {decision && (
        <DecisionOperacionModal
          operacion={decision.operacion}
          etiquetaTipo={etiquetaTipo(decision.operacion.tipo)}
          accion={decision.accion}
          onConfirmar={confirmarDecision}
          onCancelar={() => setDecision(null)}
        />
      )}
    </section>
  )
}

export default OperacionesAprobacion
