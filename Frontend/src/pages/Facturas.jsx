import { useEffect, useState } from 'react'
import { autorizarAnulacion, listarFacturas, solicitarAnulacion } from '../api/facturas.js'
import { useAuth } from '../context/AuthContext.jsx'

const MOTIVO_MAX = 300

const ESTADOS = {
  Emitida: { texto: 'Emitida', clase: 'badge-estado--emitida' },
  AnulacionSolicitada: { texto: 'Anulación solicitada', clase: 'badge-estado--solicitada' },
  Anulada: { texto: 'Anulada', clase: '' },
}

const FORMULARIO_INICIAL = { motivo: '' }

// TDSI-96: acción de solicitar anulación de una factura en la interfaz del cajero.
function Facturas() {
  // TDSI-305: quien solicita la anulación es el cajero que inició sesión.
  const { cajero } = useAuth()
  const [facturas, setFacturas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(null)

  const [facturaElegida, setFacturaElegida] = useState(null) // factura a la que se le pide anular
  const [formulario, setFormulario] = useState(FORMULARIO_INICIAL)
  const [errorValidacion, setErrorValidacion] = useState(null)
  const [errorApi, setErrorApi] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [confirmacion, setConfirmacion] = useState(null)

  // Autorización del supervisor (TDSI-384/385): código puntual, no es una sesión aparte.
  const [facturaParaAutorizar, setFacturaParaAutorizar] = useState(null)
  const [credenciales, setCredenciales] = useState({ supervisor_id: '', pin: '', observacion: '' })
  const [errorAutorizacion, setErrorAutorizacion] = useState(null)
  const [autorizando, setAutorizando] = useState(false)

  async function cargarFacturas() {
    try {
      const respuesta = await listarFacturas()
      setFacturas(respuesta.data)
      setErrorCarga(null)
    } catch (err) {
      setErrorCarga(err.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargarFacturas()
  }, [])

  function abrirFormulario(factura) {
    setFacturaElegida(factura)
    setFormulario(FORMULARIO_INICIAL)
    setErrorValidacion(null)
    setErrorApi(null)
    setConfirmacion(null)
  }

  function cancelar() {
    setFacturaElegida(null)
    setErrorValidacion(null)
    setErrorApi(null)
  }

  function actualizarCampo(campo, valor) {
    setFormulario((prev) => ({ ...prev, [campo]: valor }))
  }

  // TDSI-308: formulario del motivo de la anulación.
  async function enviarSolicitud(event) {
    event.preventDefault()

    const motivo = formulario.motivo.trim()

    if (!cajero) {
      setErrorValidacion('Inicie sesión para solicitar una anulación.')
      return
    }
    if (!motivo) {
      setErrorValidacion('Escriba el motivo de la anulación.')
      return
    }
    if (motivo.length > MOTIVO_MAX) {
      setErrorValidacion(`El motivo debe tener máximo ${MOTIVO_MAX} caracteres.`)
      return
    }

    setErrorValidacion(null)
    setErrorApi(null)
    setEnviando(true)

    try {
      await solicitarAnulacion({
        factura_numero: facturaElegida.numero,
        motivo,
        solicitado_por: cajero.nombre,
      })
      // TDSI-310: mensaje de confirmación al enviar la solicitud.
      setConfirmacion(`La anulación de la factura ${facturaElegida.numero} fue solicitada y quedó en revisión.`)
      setFacturaElegida(null)
      await cargarFacturas()
    } catch (err) {
      setErrorApi(err.message)
    } finally {
      setEnviando(false)
    }
  }

  function abrirAutorizacion(factura) {
    setFacturaParaAutorizar(factura)
    setCredenciales({ supervisor_id: '', pin: '', observacion: '' })
    setErrorAutorizacion(null)
    setConfirmacion(null)
  }

  function cancelarAutorizacion() {
    setFacturaParaAutorizar(null)
    setErrorAutorizacion(null)
  }

  function actualizarCredencial(campo, valor) {
    setCredenciales((prev) => ({ ...prev, [campo]: valor }))
  }

  // TDSI-384/385: el supervisor escribe su usuario + PIN ahí mismo, en la pantalla del cajero.
  async function resolverAnulacion(decision) {
    if (!credenciales.supervisor_id.trim() || !credenciales.pin.trim()) {
      setErrorAutorizacion('Ingrese el usuario y el PIN del supervisor.')
      return
    }

    setErrorAutorizacion(null)
    setAutorizando(true)
    try {
      await autorizarAnulacion(facturaParaAutorizar.anulacion_id, {
        supervisor_id: credenciales.supervisor_id.trim(),
        pin: credenciales.pin.trim(),
        decision,
        observacion: credenciales.observacion.trim() || undefined,
      })
      setConfirmacion(
        decision === 'APROBAR'
          ? `La factura ${facturaParaAutorizar.numero} quedó anulada.`
          : `La anulación de ${facturaParaAutorizar.numero} fue rechazada; la factura sigue Emitida.`,
      )
      setFacturaParaAutorizar(null)
      await cargarFacturas()
    } catch (err) {
      setErrorAutorizacion(err.message)
    } finally {
      setAutorizando(false)
    }
  }

  return (
    <section>
      <h1>Facturas</h1>

      {confirmacion && <p className="mensaje-exito">{confirmacion}</p>}

      {cargando && <p>Cargando...</p>}
      {errorCarga && <p className="error">Error: {errorCarga}</p>}

      {!cargando && !errorCarga && facturas.length === 0 && <p>Todavía no hay facturas emitidas.</p>}

      {facturas.length > 0 && (
        <table className="tabla-facturas">
          <thead>
            <tr>
              <th>Número</th>
              <th>Cliente</th>
              <th>Total (Bs.)</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {facturas.map((factura) => {
              const estado = ESTADOS[factura.estado] ?? { texto: factura.estado, clase: '' }
              return (
                <tr key={factura.numero}>
                  <td>{factura.numero}</td>
                  <td>{factura.cliente_nombre}</td>
                  <td>{factura.total}</td>
                  <td>
                    {/* TDSI-309: estado "Anulación solicitada" visible en la factura */}
                    <span className={`badge-estado ${estado.clase}`}>{estado.texto}</span>
                  </td>
                  <td>
                    {/* TDSI-307: botón "Solicitar anulación" */}
                    {factura.estado === 'Emitida' && (
                      <button type="button" className="btn btn-secundario" onClick={() => abrirFormulario(factura)}>
                        Solicitar anulación
                      </button>
                    )}
                    {/* Autorización del supervisor (TDSI-384/385) */}
                    {factura.estado === 'AnulacionSolicitada' && factura.anulacion_id && (
                      <button type="button" className="btn btn-secundario" onClick={() => abrirAutorizacion(factura)}>
                        Autorizar
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {facturaElegida && (
        <form className="anulacion-form" onSubmit={enviarSolicitud}>
          <h2>Solicitar anulación de {facturaElegida.numero}</h2>

          <label className="campo">
            Motivo de la anulación
            <textarea
              rows={4}
              maxLength={MOTIVO_MAX}
              value={formulario.motivo}
              onChange={(e) => actualizarCampo('motivo', e.target.value)}
            />
          </label>

          <p className="anulacion-solicitante">Solicita: {cajero ? cajero.nombre : 'sin sesión iniciada'}</p>

          {errorValidacion && <p className="error">{errorValidacion}</p>}
          {errorApi && <p className="error">Error: {errorApi}</p>}

          <div className="anulacion-acciones">
            <button type="button" className="btn btn-secundario" onClick={cancelar} disabled={enviando}>
              Cancelar
            </button>
            <button type="submit" className="btn" disabled={enviando}>
              {enviando ? 'Enviando...' : 'Enviar solicitud'}
            </button>
          </div>
        </form>
      )}

      {facturaParaAutorizar && (
        <div className="anulacion-form">
          <h2>Autorizar anulación de {facturaParaAutorizar.numero}</h2>
          <p className="anulacion-solicitante">
            Se necesita el usuario y el PIN de un supervisor de caja para aprobar o rechazar.
          </p>

          <label className="campo">
            Usuario del supervisor
            <input
              type="text"
              value={credenciales.supervisor_id}
              onChange={(e) => actualizarCredencial('supervisor_id', e.target.value)}
            />
          </label>

          <label className="campo">
            PIN
            <input
              type="password"
              inputMode="numeric"
              value={credenciales.pin}
              onChange={(e) => actualizarCredencial('pin', e.target.value)}
            />
          </label>

          <label className="campo">
            Observación (opcional)
            <textarea
              rows={2}
              maxLength={300}
              value={credenciales.observacion}
              onChange={(e) => actualizarCredencial('observacion', e.target.value)}
            />
          </label>

          {errorAutorizacion && <p className="error">Error: {errorAutorizacion}</p>}

          <div className="anulacion-acciones">
            <button type="button" className="btn btn-secundario" onClick={cancelarAutorizacion} disabled={autorizando}>
              Cancelar
            </button>
            <button type="button" className="btn btn-secundario" onClick={() => resolverAnulacion('RECHAZAR')} disabled={autorizando}>
              Rechazar
            </button>
            <button type="button" className="btn" onClick={() => resolverAnulacion('APROBAR')} disabled={autorizando}>
              {autorizando ? 'Procesando...' : 'Aprobar'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

export default Facturas
