import { useEffect, useState } from 'react'
import { listarFacturas, solicitarAnulacion } from '../api/facturas.js'
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
    </section>
  )
}

export default Facturas
