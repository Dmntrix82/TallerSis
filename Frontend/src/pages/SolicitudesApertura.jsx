import { useState } from 'react'
import AutorizacionAperturaModal from '../components/AutorizacionAperturaModal.jsx'

const ETIQUETA_ESTADO = {
  PENDIENTE: 'Pendiente',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
}

// TDSI-499: bandeja "Solicitudes de apertura" del supervisor.
// TDSI-500: botones Aprobar y Rechazar (con motivo).
// TDSI-501: estado de cada solicitud (Pendiente / Aprobada / Rechazada).
// TDSI-502: mensajes de confirmacion y de error.
//
// La conexion con el backend (../api/autorizaciones.js) se hace en otro commit:
// - cargar la bandeja: listarSolicitudesPendientes() -> setSolicitudes(r.data)
// - confirmarDecision: aprobarSolicitud / rechazarSolicitud con las credenciales del formulario.
// El backend solo devuelve las PENDIENTES; las que se resuelven aqui se quedan en la
// lista con su nuevo estado hasta que se actualice la bandeja.
function SolicitudesApertura() {
  const [solicitudes, setSolicitudes] = useState([])
  const [cargando] = useState(false)
  const [error] = useState(null)
  const [mensaje, setMensaje] = useState(null)
  const [decision, setDecision] = useState(null) // { solicitud, accion: 'APROBAR' | 'RECHAZAR' }

  function actualizarBandeja() {
    setMensaje(null)
  }

  function abrirDecision(solicitud, accion) {
    setMensaje(null)
    setDecision({ solicitud, accion })
  }

  // Lo llama el formulario con { supervisor_id, pin[, motivo_rechazo] }; si lanza error,
  // el formulario lo muestra y no se cierra. `respuesta` es la data que devuelve el backend:
  // al aprobar { autorizacion, turno }, al rechazar la autorizacion actualizada.
  function aplicarDecision(solicitud, accion, respuesta) {
    const actualizada = accion === 'APROBAR' ? respuesta.autorizacion : respuesta
    setMensaje(
      accion === 'APROBAR'
        ? `Solicitud aprobada: se abrió el turno ${respuesta.turno.codigo} en ${solicitud.caja_id}.`
        : `Solicitud de ${solicitud.caja_id} rechazada.`
    )
    setSolicitudes((prev) => prev.map((s) => (s.id === solicitud.id ? { ...s, ...actualizada } : s)))
    setDecision(null)
  }

  async function confirmarDecision() {
    throw new Error('La bandeja todavía no está conectada al servidor.')
  }

  const pendientes = solicitudes.filter((s) => s.estado === 'PENDIENTE').length

  return (
    <section>
      <h1>Solicitudes de apertura</h1>
      <p className="resumen-turno-actual">
        Cajeros que pidieron abrir su caja. Revise el efectivo inicial y apruebe o rechace con su usuario y PIN de supervisor.
      </p>

      <div className="solicitudes-barra">
        {!cargando && !error && (
          <span className="solicitudes-contador">
            {pendientes === 1 ? '1 solicitud pendiente' : `${pendientes} solicitudes pendientes`}
          </span>
        )}
        <button type="button" className="btn btn-secundario" onClick={actualizarBandeja} disabled={cargando}>
          Actualizar
        </button>
      </div>

      {mensaje && <p className="mensaje-exito solicitudes-mensaje">{mensaje}</p>}

      {cargando && <p>Cargando...</p>}

      {!cargando && error && (
        <div className="orden-mensaje orden-mensaje-error solicitudes-mensaje">
          <span>No se pudieron cargar las solicitudes: {error}</span>
        </div>
      )}

      {!cargando && !error && solicitudes.length === 0 && (
        <p className="orden-mensaje orden-mensaje-pendiente solicitudes-mensaje">
          No hay solicitudes de apertura pendientes.
        </p>
      )}

      {!cargando && !error && solicitudes.length > 0 && (
        <table className="tabla-facturas">
          <thead>
            <tr>
              <th>Caja</th>
              <th>Cajero</th>
              <th>Efectivo inicial (Bs.)</th>
              <th>Solicitada</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {solicitudes.map((s) => (
              <tr key={s.id}>
                <td>{s.caja_id}</td>
                <td>{s.cajero_nombre || s.cajero_id}</td>
                <td>{s.efectivo_inicial.toFixed(2)}</td>
                <td>{new Date(s.solicitado_en).toLocaleString()}</td>
                <td>
                  <span className={`badge-estado badge-solicitud--${s.estado.toLowerCase()}`}>
                    {ETIQUETA_ESTADO[s.estado] ?? s.estado}
                  </span>
                  {s.estado === 'RECHAZADA' && s.motivo_rechazo && (
                    <span className="solicitud-detalle">Motivo: {s.motivo_rechazo}</span>
                  )}
                  {s.estado !== 'PENDIENTE' && s.autorizado_por_nombre && (
                    <span className="solicitud-detalle">Por {s.autorizado_por_nombre}</span>
                  )}
                </td>
                <td>
                  {s.estado === 'PENDIENTE' && (
                    <div className="solicitud-acciones">
                      <button type="button" className="btn" onClick={() => abrirDecision(s, 'APROBAR')}>
                        Aprobar
                      </button>
                      <button type="button" className="btn btn-peligro" onClick={() => abrirDecision(s, 'RECHAZAR')}>
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
        <AutorizacionAperturaModal
          solicitud={decision.solicitud}
          accion={decision.accion}
          onConfirmar={confirmarDecision}
          onCancelar={() => setDecision(null)}
        />
      )}
    </section>
  )
}

export default SolicitudesApertura
