import { useEffect, useState } from 'react'
import { listarFacturasPendientesAutorizacion, autorizarAnulacion } from '../api/anulaciones.js'

const ESTADO_INICIAL_FORM = {
  anulacionId: '',
  supervisorId: '',
  pin: '',
  observacion: '',
}

function AutorizacionAnulacion() {
  const [facturas, setFacturas] = useState([])
  const [cargandoLista, setCargandoLista] = useState(true)
  const [errorLista, setErrorLista] = useState(null)

  const [modalAbierto, setModalAbierto] = useState(false)
  const [facturaContexto, setFacturaContexto] = useState(null)
  const [decision, setDecision] = useState('APROBAR')
  const [form, setForm] = useState(ESTADO_INICIAL_FORM)
  const [enviando, setEnviando] = useState(false)
  const [errorPin, setErrorPin] = useState(null)
  const [confirmacion, setConfirmacion] = useState(null)

  useEffect(() => {
    cargarPendientes()
  }, [])

  async function cargarPendientes() {
    setCargandoLista(true)
    setErrorLista(null)
    try {
      const data = await listarFacturasPendientesAutorizacion()
      setFacturas(data)
    } catch (err) {
      setErrorLista(err.message)
    } finally {
      setCargandoLista(false)
    }
  }

  function abrirModal(factura, decisionElegida) {
    setFacturaContexto(factura)
    setDecision(decisionElegida)
    setForm(ESTADO_INICIAL_FORM)
    setErrorPin(null)
    setModalAbierto(true)
  }

  function cerrarModal() {
    setModalAbierto(false)
    setFacturaContexto(null)
    setErrorPin(null)
  }

  function actualizarCampo(campo, valor) {
    setForm((prev) => ({ ...prev, [campo]: valor }))
  }

  async function confirmarAutorizacion(event) {
    event.preventDefault()

    if (!form.anulacionId || !form.supervisorId || !form.pin) {
      setErrorPin('Complete el ID de la solicitud, el supervisor y el PIN.')
      return
    }

    setEnviando(true)
    setErrorPin(null)

    try {
      const respuesta = await autorizarAnulacion(form.anulacionId, {
        supervisor_id: form.supervisorId,
        pin: form.pin,
        decision,
        observacion: form.observacion || undefined,
      })
      setConfirmacion(respuesta.mensaje)
      setModalAbierto(false)
      setTimeout(() => setConfirmacion(null), 5000)
      cargarPendientes()
    } catch (err) {
      setErrorPin(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section>
      <h1>Autorización de anulación de factura</h1>

      {confirmacion && <p className="confirmacion">{confirmacion}</p>}

      {cargandoLista && <p>Cargando facturas pendientes...</p>}
      {!cargandoLista && errorLista && <p className="error">{errorLista}</p>}

      {!cargandoLista && !errorLista && (
        facturas.length === 0 ? (
          <p>No hay facturas pendientes de autorización.</p>
        ) : (
          <ul className="anulaciones-lista">
            {facturas.map((factura) => (
              <li key={factura.numero} className="anulaciones-item">
                <div>
                  <strong>{factura.numero}</strong> — {factura.cliente_nombre || 'Sin cliente'}
                  <div className="anulaciones-detalle">
                    Bs. {factura.total} · {new Date(factura.fecha).toLocaleString()}
                  </div>
                </div>
                <div className="anulaciones-acciones">
                  <button type="button" className="btn" onClick={() => abrirModal(factura, 'APROBAR')}>
                    Aprobar
                  </button>
                  <button
                    type="button"
                    className="btn btn-secundario"
                    onClick={() => abrirModal(factura, 'RECHAZAR')}
                  >
                    Rechazar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )
      )}

      {modalAbierto && (
        <div className="modal-fondo" onClick={cerrarModal}>
          <div className="modal-caja" onClick={(e) => e.stopPropagation()}>
            <h2>{decision === 'APROBAR' ? 'Aprobar' : 'Rechazar'} anulación</h2>
            {facturaContexto && <p>Factura: {facturaContexto.numero}</p>}

            <form onSubmit={confirmarAutorizacion}>
              <label className="campo">
                ID de la solicitud de anulación
                <input
                  type="text"
                  value={form.anulacionId}
                  onChange={(e) => actualizarCampo('anulacionId', e.target.value)}
                  placeholder="Ej. 1"
                />
              </label>

              <label className="campo">
                Supervisor
                <input
                  type="text"
                  value={form.supervisorId}
                  onChange={(e) => actualizarCampo('supervisorId', e.target.value)}
                />
              </label>

              <label className="campo">
                PIN
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={form.pin}
                  onChange={(e) => actualizarCampo('pin', e.target.value.replace(/\D/g, ''))}
                />
              </label>

              <label className="campo">
                Observación (opcional)
                <input
                  type="text"
                  value={form.observacion}
                  onChange={(e) => actualizarCampo('observacion', e.target.value)}
                />
              </label>

              {errorPin && <p className="error">{errorPin}</p>}

              <div className="pago-acciones">
                <button type="button" className="btn btn-secundario" onClick={cerrarModal} disabled={enviando}>
                  Cancelar
                </button>
                <button type="submit" className="btn" disabled={enviando}>
                  {enviando ? 'Confirmando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

export default AutorizacionAnulacion
