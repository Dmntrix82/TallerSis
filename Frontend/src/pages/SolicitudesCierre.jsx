import { useEffect, useState } from 'react'
import AutorizacionCierreModal from '../components/AutorizacionCierreModal.jsx'
import { listarSolicitudesPendientes, aprobarSolicitud, rechazarSolicitud } from '../api/autorizaciones.js'
import { compararEfectivo } from '../api/caja.js'

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
// El endpoint de pendientes trae las de apertura y cierre juntas: aqui solo se usan las de
// tipo CIERRE. La solicitud no trae la diferencia, asi que por cada una se pide el arqueo
// (efectivo esperado vs contado) al endpoint comparar-efectivo del turno.
// El backend solo devuelve las PENDIENTES; las que se resuelven aqui se quedan en la
// lista con su nuevo estado hasta que se actualice la bandeja.
function SolicitudesCierre() {
  const [solicitudes, setSolicitudes] = useState([])
  const [arqueos, setArqueos] = useState({}) // id de solicitud -> { efectivoEsperado, diferencia, tipoDiferencia }
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [mensaje, setMensaje] = useState(null)
  const [decision, setDecision] = useState(null) // { solicitud, accion: 'APROBAR' | 'RECHAZAR' }
  const [recargar, setRecargar] = useState(0)

  useEffect(() => {
    let vigente = true
    setCargando(true)
    setError(null)
    setArqueos({})

    listarSolicitudesPendientes()
      .then((r) => {
        if (!vigente) return
        const deCierre = r.data.filter((s) => s.tipo === 'CIERRE')
        setSolicitudes(deCierre)

        // Si el arqueo de una solicitud falla, esa fila solo queda sin diferencia ("—").
        deCierre.forEach((s) => {
          compararEfectivo(s.turno_id, s.efectivo_contado)
            .then((a) => vigente && setArqueos((prev) => ({ ...prev, [s.id]: a.data })))
            .catch(() => {})
        })
      })
      .catch((err) => vigente && setError(err.mensaje || err.message))
      .finally(() => vigente && setCargando(false))

    return () => {
      vigente = false
    }
  }, [recargar])

  function actualizarBandeja() {
    setMensaje(null)
    setRecargar((n) => n + 1)
  }

  function abrirDecision(solicitud, accion) {
    setMensaje(null)
    setDecision({ solicitud, accion })
  }

  // Lo llama el formulario con { supervisor_id, pin[, motivo_rechazo] }; si lanza error
  // (PIN incorrecto, solicitud ya resuelta...), el formulario lo muestra y no se cierra.
  // Al aprobar el backend responde { autorizacion, turno }; al rechazar, la autorizacion.
  async function confirmarDecision(credenciales) {
    const { solicitud, accion } = decision
    const { data: respuesta } =
      accion === 'APROBAR'
        ? await aprobarSolicitud(solicitud.id, credenciales)
        : await rechazarSolicitud(solicitud.id, credenciales)

    const actualizada = accion === 'APROBAR' ? respuesta.autorizacion : respuesta
    setMensaje(
      accion === 'APROBAR'
        ? `Solicitud aprobada: se cerró el turno ${respuesta.turno.codigo} de ${solicitud.caja_id}.`
        : `Solicitud de cierre de ${solicitud.caja_id} rechazada.`
    )
    setSolicitudes((prev) => prev.map((s) => (s.id === solicitud.id ? { ...s, ...actualizada } : s)))
    setDecision(null)
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
