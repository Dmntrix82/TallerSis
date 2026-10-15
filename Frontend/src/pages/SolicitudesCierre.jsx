import { useState } from 'react'
import AutorizacionCierreModal from '../components/AutorizacionCierreModal.jsx'

const ETIQUETA_ESTADO = {
  PENDIENTE: 'Pendiente',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
}

const ETIQUETA_DIFERENCIA = {
  CUADRA: 'Cuadra',
  SOBRANTE: 'Sobrante',
  FALTANTE: 'Faltante',
}

// TDSI-503: bandeja "Solicitudes de cierre" del supervisor, con efectivo contado y diferencia.
// TDSI-504: botones Aprobar y Rechazar (con motivo).
// TDSI-505: estado de cada solicitud (Pendiente / Aprobada / Rechazada).
// TDSI-506: mensajes de confirmacion y de error.
//
// La conexion con el backend se hace en otro commit:
// - cargar la bandeja: listarSolicitudesPendientes() (../api/autorizaciones.js) trae apertura y
//   cierre juntas -> quedarse con tipo === 'CIERRE' y setSolicitudes(...)
// - diferencia: por cada solicitud, compararEfectivo(s.turno_id, s.efectivo_contado)
//   (../api/caja.js) -> guardar r.data en arqueos[s.id]
// - confirmarDecision: aprobarSolicitud / rechazarSolicitud con las credenciales del formulario.
// El backend solo devuelve las PENDIENTES; las que se resuelven aqui se quedan en la
// lista con su nuevo estado hasta que se actualice la bandeja.
function SolicitudesCierre() {
  const [solicitudes, setSolicitudes] = useState([])
  const [arqueos] = useState({}) // id de solicitud -> { efectivoEsperado, diferencia, tipoDiferencia }
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
        ? `Solicitud aprobada: se cerró el turno ${respuesta.turno.codigo} de ${solicitud.caja_id}.`
        : `Solicitud de cierre de ${solicitud.caja_id} rechazada.`
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
      <h1>Solicitudes de cierre</h1>
      <p className="resumen-turno-actual">
        Cajeros que pidieron cerrar su caja. Revise el efectivo contado y la diferencia, y apruebe o rechace con su usuario y PIN de supervisor.
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
          No hay solicitudes de cierre pendientes.
        </p>
      )}

      {!cargando && !error && solicitudes.length > 0 && (
        <table className="tabla-facturas">
          <thead>
            <tr>
              <th>Caja</th>
              <th>Cajero</th>
              <th>Efectivo contado (Bs.)</th>
              <th>Diferencia (Bs.)</th>
              <th>Solicitada</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {solicitudes.map((s) => {
              const arqueo = arqueos[s.id]
              return (
                <tr key={s.id}>
                  <td>{s.caja_id}</td>
                  <td>{s.cajero_nombre || s.cajero_id}</td>
                  <td>{s.efectivo_contado.toFixed(2)}</td>
                  <td>
                    {arqueo ? (
                      <>
                        <span className={`diferencia diferencia--${arqueo.tipoDiferencia.toLowerCase()}`}>
                          {arqueo.diferencia > 0 ? '+' : ''}
                          {arqueo.diferencia.toFixed(2)} · {ETIQUETA_DIFERENCIA[arqueo.tipoDiferencia]}
                        </span>
                        <span className="solicitud-detalle">Esperado: {arqueo.efectivoEsperado.toFixed(2)}</span>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
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
              )
            })}
          </tbody>
        </table>
      )}

      {decision && (
        <AutorizacionCierreModal
          solicitud={decision.solicitud}
          arqueo={arqueos[decision.solicitud.id]}
          accion={decision.accion}
          onConfirmar={confirmarDecision}
          onCancelar={() => setDecision(null)}
        />
      )}
    </section>
  )
}

export default SolicitudesCierre
