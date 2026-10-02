import { useState } from 'react'
import { registrarPago, registrarPagoMixto, enviarFacturaPorCorreo, urlFacturaPdf, buscarClientePorDocumento } from '../api/pagos.js'
import PagoMixtoForm from '../components/PagoMixtoForm.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const METODOS_PAGO = [
  {
    id: 'Efectivo',
    etiqueta: 'Efectivo',
    icono: (
      <svg width="32" height="20" viewBox="0 0 32 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="1" width="30" height="18" rx="2" />
        <circle cx="16" cy="10" r="4" />
        <circle cx="5" cy="10" r="1" fill="currentColor" stroke="none" />
        <circle cx="27" cy="10" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: 'Tarjeta',
    etiqueta: 'Tarjeta',
    icono: (
      <svg width="32" height="22" viewBox="0 0 32 22" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="1" width="30" height="20" rx="3" />
        <rect x="1" y="6" width="30" height="4" fill="currentColor" stroke="none" />
        <line x1="5" y1="16" x2="13" y2="16" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'QR',
    etiqueta: 'QR',
    icono: (
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="1" width="8" height="8" />
        <rect x="17" y="1" width="8" height="8" />
        <rect x="1" y="17" width="8" height="8" />
        <rect x="3.5" y="3.5" width="3" height="3" fill="currentColor" stroke="none" />
        <rect x="19.5" y="3.5" width="3" height="3" fill="currentColor" stroke="none" />
        <rect x="3.5" y="19.5" width="3" height="3" fill="currentColor" stroke="none" />
        <rect x="14" y="14" width="3" height="3" fill="currentColor" stroke="none" />
        <rect x="20" y="14" width="3" height="3" fill="currentColor" stroke="none" />
        <rect x="14" y="20" width="3" height="3" fill="currentColor" stroke="none" />
        <rect x="20" y="20" width="3" height="3" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
]

const TIPOS_DOCUMENTO = [
  { id: 'NINGUNO', etiqueta: 'Sin datos' },
  { id: 'NIT', etiqueta: 'NIT' },
  { id: 'CI', etiqueta: 'CI' },
]

const ESTADO_INICIAL = {
  monto: '',
  metodos: [], // 1 metodo = pago simple, 2 metodos = pago mixto
  montoMixto1: '',
  montoMixto2: '',
  tipoDocumento: 'NINGUNO',
  numeroDocumento: '',
  razonSocial: '',
  telefono: '',
  enviarCorreo: null, // null = sin elegir, true/false = Si/No
  email: '',
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// En Bolivia el NIT tiene exactamente 10 dígitos; el CI tiene 7 u 8.
const REGEX_DOCUMENTO = {
  NIT: /^\d{10}$/,
  CI: /^\d{7,8}$/,
}
const MAX_LARGO_DOCUMENTO = { NIT: 10, CI: 8 }
const MENSAJE_FORMATO_DOCUMENTO = {
  NIT: 'El NIT debe tener exactamente 10 dígitos.',
  CI: 'El CI debe tener entre 7 y 8 dígitos.',
}

function validarFormulario(datos) {
  if (!datos.monto || Number(datos.monto) <= 0) {
    return 'Ingrese un monto válido.'
  }
  if (datos.metodos.length === 0) {
    return 'Seleccione un método de pago.'
  }
  if (datos.metodos.length === 2) {
    const m1 = Number(datos.montoMixto1)
    const m2 = Number(datos.montoMixto2)
    if (!datos.montoMixto1 || !datos.montoMixto2 || m1 <= 0 || m2 <= 0) {
      return 'Complete el monto de cada método del pago mixto.'
    }
    if (Math.round((m1 + m2) * 100) !== Math.round(Number(datos.monto) * 100)) {
      return 'La suma de los montos del pago mixto debe ser igual al monto total.'
    }
  }
  if (datos.tipoDocumento !== 'NINGUNO') {
    if (!datos.numeroDocumento.trim() || !datos.razonSocial.trim()) {
      return `Complete el número de ${datos.tipoDocumento} y la razón social.`
    }
    if (!REGEX_DOCUMENTO[datos.tipoDocumento].test(datos.numeroDocumento.trim())) {
      return MENSAJE_FORMATO_DOCUMENTO[datos.tipoDocumento]
    }
  }
  if (datos.enviarCorreo === true && !EMAIL_REGEX.test(datos.email.trim())) {
    return 'Ingrese un correo válido para enviar la factura.'
  }
  return null
}

function Pagos() {
  const { cajero } = useAuth()
  const [datos, setDatos] = useState(ESTADO_INICIAL)
  const [paso, setPaso] = useState('formulario')
  const [errorValidacion, setErrorValidacion] = useState(null)
  const [errorApi, setErrorApi] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [pagoRegistrado, setPagoRegistrado] = useState(null)
  const [envioFactura, setEnvioFactura] = useState(null) // { ok, mensaje } | null
  const [enviandoFactura, setEnviandoFactura] = useState(false)

  const esMixto = datos.metodos.length === 2
  const mostrarPanelMixto = esMixto && paso === 'formulario'

  function actualizarCampo(campo, valor) {
    setDatos((prev) => ({ ...prev, [campo]: valor }))
  }

  function elegirTipoDocumento(tipoDocumento) {
    setDatos((prev) => ({
      ...prev,
      tipoDocumento,
      numeroDocumento: tipoDocumento === 'NINGUNO' ? '' : prev.numeroDocumento,
      razonSocial: tipoDocumento === 'NINGUNO' ? '' : prev.razonSocial,
    }))
  }

  // Si ese NIT/CI ya se uso en un pago anterior, se autocompleta la razon social
  // (el cajero puede seguir editandola a mano si hace falta corregirla).
  async function alPerderFocoDocumento() {
    const tipoDocumento = datos.tipoDocumento
    const numero = datos.numeroDocumento.trim()
    if (tipoDocumento === 'NINGUNO' || !REGEX_DOCUMENTO[tipoDocumento].test(numero)) {
      return
    }
    try {
      const respuesta = await buscarClientePorDocumento(tipoDocumento, numero)
      if (respuesta.data?.razon_social) {
        actualizarCampo('razonSocial', respuesta.data.razon_social)
      }
    } catch {
      // Si falla la busqueda, el cajero simplemente escribe la razon social a mano.
    }
  }

  // Se puede elegir hasta 2 métodos para un pago mixto, pero Tarjeta + QR no es
  // una combinación válida: un pago mixto siempre debe incluir Efectivo. Al cambiar
  // la combinación se limpian los montos del pago mixto (ya no corresponden).
  function toggleMetodo(id) {
    const actuales = datos.metodos

    if (actuales.includes(id)) {
      setErrorValidacion(null)
      setDatos((prev) => ({ ...prev, metodos: prev.metodos.filter((m) => m !== id), montoMixto1: '', montoMixto2: '' }))
      return
    }

    if (actuales.length === 2) {
      return
    }

    if (actuales.length === 1) {
      const combinacion = [...actuales, id]
      if (combinacion.includes('Tarjeta') && combinacion.includes('QR')) {
        setErrorValidacion('No puede combinar Tarjeta y QR. Un pago con 2 métodos debe incluir Efectivo.')
        return
      }
    }

    setErrorValidacion(null)
    setDatos((prev) => ({ ...prev, metodos: [...prev.metodos, id], montoMixto1: '', montoMixto2: '' }))
  }

  function continuar(event) {
    event.preventDefault()
    const mensaje = validarFormulario(datos)
    if (mensaje) {
      // El formato del NIT/CI ya se avisa abajo del propio campo: no repetirlo aquí.
      const esFormatoDocumento = datos.tipoDocumento !== 'NINGUNO' && mensaje === MENSAJE_FORMATO_DOCUMENTO[datos.tipoDocumento]
      setErrorValidacion(esFormatoDocumento ? null : mensaje)
      return
    }
    setErrorValidacion(null)
    setPaso('confirmacion')
  }

  function cambiarMetodo() {
    setErrorApi(null)
    setPaso('formulario')
  }

  async function confirmarCobro() {
    setEnviando(true)
    setErrorApi(null)

    const datosFacturacion = {}
    if (datos.tipoDocumento !== 'NINGUNO') {
      datosFacturacion.tipo_documento = datos.tipoDocumento
      datosFacturacion.nit = datos.numeroDocumento.trim()
      datosFacturacion.razon_social = datos.razonSocial.trim()
    }
    if (datos.telefono.trim()) {
      datosFacturacion.telefono = datos.telefono.trim()
    }
    if (datos.enviarCorreo) {
      datosFacturacion.email = datos.email.trim()
    }

    try {
      let idTransaccionRegistrada

      if (esMixto) {
        const payload = {
          ...datosFacturacion,
          total: Number(datos.monto),
          metodos: [
            { metodo: datos.metodos[0], monto: Number(datos.montoMixto1) },
            { metodo: datos.metodos[1], monto: Number(datos.montoMixto2) },
          ],
          cajaId: cajero?.caja,
          cajero: cajero?.nombre,
        }
        const respuesta = await registrarPagoMixto(payload)
        idTransaccionRegistrada = respuesta.data.pago.id_transaccion
        setPagoRegistrado({
          id_transaccion: respuesta.data.pago.id_transaccion,
          monto: respuesta.data.pago.total,
          estado: respuesta.data.pago.estado,
          fecha: respuesta.data.pago.fecha,
          detalle: respuesta.data.detalle,
        })
      } else {
        const payload = {
          ...datosFacturacion,
          metodo: datos.metodos[0],
          monto: Number(datos.monto),
          caja_id: cajero?.caja,
          cajero: cajero?.nombre,
        }
        const respuesta = await registrarPago(payload)
        idTransaccionRegistrada = respuesta.pago.id_transaccion
        setPagoRegistrado({ ...respuesta.pago, detalle: null })
      }

      setPaso('listo')

      // El correo ya se pidió en el formulario: se envía solo, sin volver a preguntar.
      if (datos.enviarCorreo && datos.email.trim()) {
        setEnviandoFactura(true)
        try {
          const r = await enviarFacturaPorCorreo(idTransaccionRegistrada, datos.email.trim())
          setEnvioFactura({ ok: true, mensaje: r.mensaje })
        } catch (err) {
          setEnvioFactura({ ok: false, mensaje: err.message })
        } finally {
          setEnviandoFactura(false)
        }
      }
    } catch (err) {
      setErrorApi(err.message)
    } finally {
      setEnviando(false)
    }
  }

  function registrarOtro() {
    setDatos(ESTADO_INICIAL)
    setPagoRegistrado(null)
    setEnvioFactura(null)
    setPaso('formulario')
  }

  return (
    <section>
      <h1>Método de pago</h1>

      <div className={`pagos-layout${mostrarPanelMixto ? ' pagos-layout--dividido' : ''}`}>
        <div className="pagos-layout-col">
          {paso === 'formulario' && (
            <form className="pago-form" onSubmit={continuar}>
              {/* El ID de transacción ya no lo escribe el cajero: lo genera el sistema al confirmar el cobro. */}
              <label className="campo">
                Monto (Bs.)
                <input type="number" step="0.01" value={datos.monto} onChange={(e) => actualizarCampo('monto', e.target.value)} />
              </label>

              <fieldset className="metodo-opciones" style={{ border: 'none', padding: 0 }}>
                <legend>Método de pago (puede elegir hasta 2 para un pago mixto)</legend>
                <div className="metodo-pago-opciones">
                  {METODOS_PAGO.map((metodo) => (
                    <button
                      key={metodo.id}
                      type="button"
                      className={`metodo-pago-opcion${datos.metodos.includes(metodo.id) ? ' activa' : ''}`}
                      onClick={() => toggleMetodo(metodo.id)}
                    >
                      {metodo.icono}
                      {metodo.etiqueta}
                    </button>
                  ))}
                </div>
                {esMixto && <p className="ayuda-mixto">Pago mixto: complete los montos en el panel de la derecha.</p>}
              </fieldset>

              <fieldset style={{ border: 'none', padding: 0 }}>
                <legend>Datos de facturación</legend>
                <div className="tipo-venta-opciones">
                  {TIPOS_DOCUMENTO.map((tipo) => (
                    <button
                      key={tipo.id}
                      type="button"
                      className={`tipo-venta-opcion${datos.tipoDocumento === tipo.id ? ' activa' : ''}`}
                      onClick={() => elegirTipoDocumento(tipo.id)}
                    >
                      {tipo.etiqueta}
                    </button>
                  ))}
                </div>
              </fieldset>

              {datos.tipoDocumento !== 'NINGUNO' && (
                <>
                  <label className="campo">
                    Número de {datos.tipoDocumento}
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={MAX_LARGO_DOCUMENTO[datos.tipoDocumento]}
                      value={datos.numeroDocumento}
                      onChange={(e) => actualizarCampo('numeroDocumento', e.target.value.replace(/\D/g, ''))}
                      onBlur={alPerderFocoDocumento}
                    />
                  </label>
                  {datos.numeroDocumento && !REGEX_DOCUMENTO[datos.tipoDocumento].test(datos.numeroDocumento) && (
                    <p className="error" style={{ marginTop: '-0.75rem' }}>
                      {MENSAJE_FORMATO_DOCUMENTO[datos.tipoDocumento]}
                    </p>
                  )}
                  <label className="campo">
                    Razón social
                    <input
                      type="text"
                      value={datos.razonSocial}
                      onChange={(e) => actualizarCampo('razonSocial', e.target.value)}
                    />
                  </label>
                </>
              )}

              <label className="campo">
                Teléfono del cliente (opcional)
                <input type="tel" value={datos.telefono} onChange={(e) => actualizarCampo('telefono', e.target.value)} />
              </label>

              <div className="factura-correo">
                <p>¿Desea enviar la factura al cliente por correo?</p>
                <div className="factura-correo-acciones">
                  <button
                    type="button"
                    className={`btn${datos.enviarCorreo === false ? '' : ' btn-secundario'}`}
                    onClick={() => actualizarCampo('enviarCorreo', false)}
                  >
                    No
                  </button>
                  <button
                    type="button"
                    className={`btn${datos.enviarCorreo === true ? '' : ' btn-secundario'}`}
                    onClick={() => actualizarCampo('enviarCorreo', true)}
                  >
                    Sí
                  </button>
                </div>

                {datos.enviarCorreo === true && (
                  <label className="campo" style={{ marginTop: '1rem' }}>
                    Correo del cliente
                    <input type="email" value={datos.email} onChange={(e) => actualizarCampo('email', e.target.value)} />
                  </label>
                )}
              </div>

              {errorValidacion && <p className="error">{errorValidacion}</p>}

              <button type="submit" className="btn">
                Continuar
              </button>
            </form>
          )}

          {paso === 'confirmacion' && (
            <div className="pago-resumen">
              <h2>Confirmar cobro</h2>
              <ul>
                <li>Monto: Bs. {datos.monto}</li>
                {esMixto ? (
                  <li>
                    Métodos de pago: {datos.metodos[0]} (Bs. {datos.montoMixto1}) + {datos.metodos[1]} (Bs. {datos.montoMixto2})
                  </li>
                ) : (
                  <li>Método de pago: {datos.metodos[0]}</li>
                )}
                <li>
                  Datos de facturación:{' '}
                  {datos.tipoDocumento === 'NINGUNO'
                    ? 'Sin datos'
                    : `${datos.tipoDocumento} ${datos.numeroDocumento} — ${datos.razonSocial}`}
                </li>
                {datos.telefono && <li>Teléfono: {datos.telefono}</li>}
                <li>
                  Envío por correo:{' '}
                  {datos.enviarCorreo ? `Sí, a ${datos.email}` : 'No'}
                </li>
              </ul>

              {errorApi && <p className="error">Error: {errorApi}</p>}

              <div className="pago-acciones">
                <button type="button" className="btn btn-secundario" onClick={cambiarMetodo} disabled={enviando}>
                  Editar
                </button>
                <button type="button" className="btn" onClick={confirmarCobro} disabled={enviando}>
                  {enviando ? 'Confirmando...' : 'Confirmar cobro'}
                </button>
              </div>
            </div>
          )}

          {paso === 'listo' && pagoRegistrado && (
            <div className="pago-exito">
              <h2>Pago registrado</h2>
              <ul>
                <li>ID de transacción: {pagoRegistrado.id_transaccion}</li>
                {pagoRegistrado.detalle ? (
                  pagoRegistrado.detalle.map((d) => (
                    <li key={d.orden}>{d.metodo}: Bs. {d.monto}</li>
                  ))
                ) : (
                  <li>Método de pago: {pagoRegistrado.metodo}</li>
                )}
                <li>Monto: Bs. {pagoRegistrado.monto}</li>
                <li>Estado: {pagoRegistrado.estado}</li>
                <li>Fecha: {new Date(pagoRegistrado.fecha).toLocaleString()}</li>
              </ul>

              {datos.enviarCorreo && (
                <p className={enviandoFactura ? '' : envioFactura?.ok ? 'mensaje-exito' : 'error'}>
                  {enviandoFactura ? 'Enviando factura por correo...' : envioFactura?.mensaje}
                </p>
              )}

              <div className="pago-exito-acciones">
                {/* TDSI-303: factura real en PDF (formato tirilla), lista para ver o imprimir */}
                <a
                  href={urlFacturaPdf(pagoRegistrado.id_transaccion)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-azul"
                  style={{ display: 'inline-block', textDecoration: 'none', textAlign: 'center' }}
                >
                  Ver / Imprimir factura
                </a>

                <button type="button" className="btn" onClick={registrarOtro}>
                  Registrar otro pago
                </button>
              </div>
            </div>
          )}
        </div>

        {mostrarPanelMixto && (
          <div className="pagos-layout-col">
            <PagoMixtoForm
              totalVenta={Number(datos.monto) || 0}
              metodo1={datos.metodos[0]}
              metodo2={datos.metodos[1]}
              monto1={datos.montoMixto1}
              monto2={datos.montoMixto2}
              onCambiarMonto1={(valor) => actualizarCampo('montoMixto1', valor)}
              onCambiarMonto2={(valor) => actualizarCampo('montoMixto2', valor)}
            />
          </div>
        )}
      </div>
    </section>
  )
}

export default Pagos
