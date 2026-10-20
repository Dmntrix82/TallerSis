import { useEffect, useState } from 'react'
import { registrarPago, registrarPagoMixto, enviarFacturaPorCorreo, urlFacturaPdf, buscarClientePorDocumento } from '../api/pagos.js'
import { calcularVuelto, crearCobroQr, consultarEstadoCobroQr, confirmarCobroQr, urlQrCuenta } from '../api/cobros.js'
import { calcularFactura } from '../api/calculoFactura.js'
import PagoMixtoForm from '../components/PagoMixtoForm.jsx'
import { useAuth } from '../context/AuthContext.jsx'

// TDSI-29/572: botones rápidos de billetes para armar el monto recibido en efectivo.
const BILLETES_RAPIDOS = [10, 20, 50, 100, 200]
const ITEM_VACIO = { cantidad: '', precioUnitario: '' }

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
  montoRecibido: '', // TDSI-29: solo aplica a pago simple en Efectivo
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

function formatearTiempoRestante(segundos) {
  if (segundos == null) return null
  const minutos = Math.floor(segundos / 60)
  const resto = segundos % 60
  return `${minutos}:${String(resto).padStart(2, '0')}`
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
  // TDSI-29/548: en efectivo (pago simple) hay que saber cuánto dio el cliente,
  // y no puede ser menor al total (no se puede dar un vuelto negativo).
  if (datos.metodos.length === 1 && datos.metodos[0] === 'Efectivo') {
    if (!datos.montoRecibido || Number(datos.montoRecibido) <= 0) {
      return 'Ingrese cuánto dinero recibió del cliente.'
    }
    if (Number(datos.montoRecibido) < Number(datos.monto)) {
      return 'El monto recibido es insuficiente: es menor al total a cobrar.'
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
  const [cobroQr, setCobroQr] = useState(null) // { id, referencia, monto, estado, expira_en } | null
  const [segundosRestantes, setSegundosRestantes] = useState(null)

  // TDSI-29: vuelto calculado por el backend (endpoint dedicado), en vivo mientras se escribe.
  const [vuelto, setVuelto] = useState(null)
  const [errorVuelto, setErrorVuelto] = useState(null)
  const [calculandoVuelto, setCalculandoVuelto] = useState(false)

  // TDSI-40: detalle de factura por ítems (cantidad x precio unitario), opcional.
  // Cuando se usa, el monto se calcula solo y reemplaza la entrada manual.
  const [usarDetalle, setUsarDetalle] = useState(false)
  const [itemsDetalle, setItemsDetalle] = useState([ITEM_VACIO])
  const [descuentoDetalle, setDescuentoDetalle] = useState('')
  const [calculoFactura, setCalculoFactura] = useState(null)
  const [calculandoFactura, setCalculandoFactura] = useState(false)
  const [errorCalculoFactura, setErrorCalculoFactura] = useState(null)

  const esMixto = datos.metodos.length === 2
  const esQrSimple = datos.metodos.length === 1 && datos.metodos[0] === 'QR'
  const mostrarPanelMixto = esMixto && paso === 'formulario'
  const esEfectivoSimple = datos.metodos.length === 1 && datos.metodos[0] === 'Efectivo'

  // TDSI-39/532: mientras se espera el pago, se consulta el estado cada 4s
  // (el backend es quien decide si ya expiro o si se confirmo).
  useEffect(() => {
    if (paso !== 'esperando-qr' || !cobroQr || cobroQr.estado !== 'Pendiente') {
      return
    }
    const intervalo = setInterval(async () => {
      try {
        const actualizado = await consultarEstadoCobroQr(cobroQr.id)
        setCobroQr(actualizado)
      } catch {
        // Si falla la consulta (p.ej. problema de red) se reintenta en el siguiente ciclo.
      }
    }, 4000)
    return () => clearInterval(intervalo)
  }, [paso, cobroQr?.id, cobroQr?.estado])

  // TDSI-39/533: cuenta regresiva en pantalla hasta que expira el QR (solo visual;
  // la autoridad sobre si expiro o no la tiene el backend, via el polling de arriba).
  useEffect(() => {
    if (!cobroQr || cobroQr.estado !== 'Pendiente') {
      setSegundosRestantes(null)
      return
    }
    function recalcular() {
      setSegundosRestantes(Math.max(0, Math.round((new Date(cobroQr.expira_en).getTime() - Date.now()) / 1000)))
    }
    recalcular()
    const intervalo = setInterval(recalcular, 1000)
    return () => clearInterval(intervalo)
  }, [cobroQr?.expira_en, cobroQr?.estado])

  // TDSI-40/537: recalcula en el backend (debounced) cada vez que cambia algun
  // item o el descuento, y usa el total resultante como el monto de la venta.
  useEffect(() => {
    if (!usarDetalle) {
      return
    }

    const itemsValidos = itemsDetalle.filter(
      (item) => Number(item.cantidad) > 0 && Number(item.precioUnitario) > 0,
    )
    if (itemsValidos.length === 0) {
      setCalculoFactura(null)
      setErrorCalculoFactura(null)
      actualizarCampo('monto', '')
      return
    }

    setCalculandoFactura(true)
    setErrorCalculoFactura(null)
    const temporizador = setTimeout(async () => {
      try {
        const resultado = await calcularFactura({
          items: itemsValidos.map((item) => ({
            cantidad: Number(item.cantidad),
            precio_unitario: Number(item.precioUnitario),
          })),
          descuento: Number(descuentoDetalle) || 0,
        })
        setCalculoFactura(resultado)
        actualizarCampo('monto', String(resultado.total))
      } catch (err) {
        setCalculoFactura(null)
        setErrorCalculoFactura(err.message)
        actualizarCampo('monto', '')
      } finally {
        setCalculandoFactura(false)
      }
    }, 300)

    return () => clearTimeout(temporizador)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usarDetalle, JSON.stringify(itemsDetalle), descuentoDetalle])

  function actualizarCampo(campo, valor) {
    setDatos((prev) => ({ ...prev, [campo]: valor }))
  }

  // TDSI-29/571: apenas hay total + monto recibido validos, se consulta el
  // vuelto al backend (nunca se calcula "de mentira" solo en el navegador).
  useEffect(() => {
    if (!esEfectivoSimple || !datos.monto || !datos.montoRecibido) {
      setVuelto(null)
      setErrorVuelto(null)
      return
    }
    const total = Number(datos.monto)
    const montoRecibido = Number(datos.montoRecibido)
    if (!(total > 0) || !(montoRecibido > 0)) {
      setVuelto(null)
      setErrorVuelto(null)
      return
    }

    let cancelado = false
    setCalculandoVuelto(true)
    const timeout = setTimeout(async () => {
      try {
        const r = await calcularVuelto(total, montoRecibido)
        if (!cancelado) {
          setVuelto(r.data.vuelto)
          setErrorVuelto(null)
        }
      } catch (err) {
        if (!cancelado) {
          setVuelto(null)
          setErrorVuelto(err.message)
        }
      } finally {
        if (!cancelado) setCalculandoVuelto(false)
      }
    }, 300)

    return () => {
      cancelado = true
      clearTimeout(timeout)
    }
  }, [esEfectivoSimple, datos.monto, datos.montoRecibido])

  // TDSI-29/572: cada click suma ese billete al monto recibido (se puede combinar varios).
  function agregarBillete(valor) {
    setDatos((prev) => ({ ...prev, montoRecibido: String((Number(prev.montoRecibido) || 0) + valor) }))
  }

  function elegirTipoDocumento(tipoDocumento) {
    setDatos((prev) => ({
      ...prev,
      tipoDocumento,
      numeroDocumento: tipoDocumento === 'NINGUNO' ? '' : prev.numeroDocumento,
      razonSocial: tipoDocumento === 'NINGUNO' ? '' : prev.razonSocial,
    }))
  }

  function toggleUsarDetalle(valor) {
    setUsarDetalle(valor)
    setCalculoFactura(null)
    setErrorCalculoFactura(null)
    if (!valor) {
      actualizarCampo('monto', '')
    }
  }

  function agregarItemDetalle() {
    setItemsDetalle((prev) => [...prev, ITEM_VACIO])
  }

  function quitarItemDetalle(indice) {
    setItemsDetalle((prev) => prev.filter((_, i) => i !== indice))
  }

  function actualizarItemDetalle(indice, campo, valor) {
    setItemsDetalle((prev) => prev.map((item, i) => (i === indice ? { ...item, [campo]: valor } : item)))
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
      setDatos((prev) => ({ ...prev, metodos: prev.metodos.filter((m) => m !== id), montoMixto1: '', montoMixto2: '', montoRecibido: '' }))
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
    setDatos((prev) => ({ ...prev, metodos: [...prev.metodos, id], montoMixto1: '', montoMixto2: '', montoRecibido: '' }))
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

  function construirDatosFacturacion() {
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
    return datosFacturacion
  }

  // El correo ya se pidió en el formulario: se envía solo, sin volver a preguntar.
  async function enviarFacturaSiCorresponde(idTransaccion) {
    if (!datos.enviarCorreo || !datos.email.trim()) {
      return
    }
    setEnviandoFactura(true)
    try {
      const r = await enviarFacturaPorCorreo(idTransaccion, datos.email.trim())
      setEnvioFactura({ ok: true, mensaje: r.mensaje })
    } catch (err) {
      setEnvioFactura({ ok: false, mensaje: err.message })
    } finally {
      setEnviandoFactura(false)
    }
  }

  async function confirmarCobro() {
    // El QR no se registra como venta todavia: primero hay que generarlo y
    // esperar a que el cajero confirme que vio llegar el pago (ver abajo).
    if (esQrSimple) {
      await generarCobroQr()
      return
    }

    setEnviando(true)
    setErrorApi(null)
    const datosFacturacion = construirDatosFacturacion()

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
        if (esEfectivoSimple && datos.montoRecibido) {
          payload.monto_recibido = Number(datos.montoRecibido)
        }
        const respuesta = await registrarPago(payload)
        idTransaccionRegistrada = respuesta.pago.id_transaccion
        setPagoRegistrado({ ...respuesta.pago, detalle: null })
      }

      setPaso('listo')
      await enviarFacturaSiCorresponde(idTransaccionRegistrada)
    } catch (err) {
      setErrorApi(err.message)
    } finally {
      setEnviando(false)
    }
  }

  // TDSI-39/531: crea el cobro pendiente que se muestra junto al QR fijo de la
  // cuenta (se usa tanto para generarlo la primera vez como para "Regenerar QR").
  async function generarCobroQr() {
    setEnviando(true)
    setErrorApi(null)
    try {
      const cobro = await crearCobroQr({ monto: Number(datos.monto), caja_id: cajero?.caja, cajero: cajero?.nombre })
      setCobroQr(cobro)
      setPaso('esperando-qr')
    } catch (err) {
      setErrorApi(err.message)
    } finally {
      setEnviando(false)
    }
  }

  async function registrarVentaQr() {
    const payload = {
      ...construirDatosFacturacion(),
      metodo: 'QR',
      monto: Number(datos.monto),
      caja_id: cajero?.caja,
      cajero: cajero?.nombre,
    }
    const respuesta = await registrarPago(payload)
    setPagoRegistrado({ ...respuesta.pago, detalle: null })
    setPaso('listo')
    await enviarFacturaSiCorresponde(respuesta.pago.id_transaccion)
  }

  // TDSI-39/533: el cajero confirma a mano que vio llegar el deposito. Recien
  // ahi se registra la venta real (factura, correo, PDF), igual que cualquier
  // otro metodo de pago.
  async function confirmarPagoQrRecibido() {
    setEnviando(true)
    setErrorApi(null)
    try {
      await confirmarCobroQr(cobroQr.id, cajero?.nombre)
      await registrarVentaQr()
    } catch (err) {
      setErrorApi(err.message)
      // Si el error fue porque el QR ya expiro (o porque el cobro quedo
      // confirmado pero el registro de la venta falló a mitad de camino),
      // se refresca el estado para que la pantalla ofrezca la accion correcta.
      try {
        setCobroQr(await consultarEstadoCobroQr(cobroQr.id))
      } catch {
        // Si tampoco se puede consultar el estado, se deja el error de arriba.
      }
    } finally {
      setEnviando(false)
    }
  }

  // Cubre el caso en que el cobro ya quedo "Pagado" en el servidor pero el
  // registro de la venta fallo (p.ej. corte de red): no hay que volver a
  // confirmar el cobro (ya esta confirmado), solo reintentar la venta.
  async function reintentarRegistroVentaQr() {
    setEnviando(true)
    setErrorApi(null)
    try {
      await registrarVentaQr()
    } catch (err) {
      setErrorApi(err.message)
    } finally {
      setEnviando(false)
    }
  }

  function cancelarCobroQr() {
    setCobroQr(null)
    setErrorApi(null)
    setPaso('confirmacion')
  }

  function registrarOtro() {
    setDatos(ESTADO_INICIAL)
    setPagoRegistrado(null)
    setEnvioFactura(null)
    setCobroQr(null)
    setUsarDetalle(false)
    setItemsDetalle([ITEM_VACIO])
    setDescuentoDetalle('')
    setCalculoFactura(null)
    setErrorCalculoFactura(null)
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
                <input
                  type="number"
                  step="0.01"
                  value={datos.monto}
                  readOnly={usarDetalle}
                  onChange={(e) => actualizarCampo('monto', e.target.value)}
                />
              </label>
              {usarDetalle && <p className="ayuda-detalle-factura">El monto se calcula a partir del detalle de ítems de abajo.</p>}

              <div className="detalle-factura-toggle">
                <p>¿Desea calcular el monto a partir de un detalle de ítems (cantidad × precio)?</p>
                <div className="factura-correo-acciones">
                  <button
                    type="button"
                    className={`btn${!usarDetalle ? '' : ' btn-secundario'}`}
                    onClick={() => toggleUsarDetalle(false)}
                  >
                    No
                  </button>
                  <button
                    type="button"
                    className={`btn${usarDetalle ? '' : ' btn-secundario'}`}
                    onClick={() => toggleUsarDetalle(true)}
                  >
                    Sí
                  </button>
                </div>
              </div>

              {usarDetalle && (
                <div className="detalle-factura">
                  <table className="detalle-factura-tabla">
                    <thead>
                      <tr>
                        <th>Ítem</th>
                        <th>Cantidad</th>
                        <th>Precio unit. (Bs.)</th>
                        <th>Subtotal</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemsDetalle.map((item, indice) => {
                        const calculado = calculoFactura?.items?.[indice]
                        return (
                          <tr key={indice}>
                            <td>{indice + 1}</td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={item.cantidad}
                                onChange={(e) => actualizarItemDetalle(indice, 'cantidad', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.precioUnitario}
                                onChange={(e) => actualizarItemDetalle(indice, 'precioUnitario', e.target.value)}
                              />
                            </td>
                            <td>{calculado ? `Bs. ${calculado.subtotal.toFixed(2)}` : '—'}</td>
                            <td>
                              {itemsDetalle.length > 1 && (
                                <button
                                  type="button"
                                  className="detalle-factura-quitar"
                                  onClick={() => quitarItemDetalle(indice)}
                                >
                                  Quitar
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>

                  <button type="button" className="btn btn-secundario" onClick={agregarItemDetalle}>
                    + Agregar ítem
                  </button>

                  <label className="campo" style={{ marginTop: '1rem' }}>
                    Descuento (Bs., opcional)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={descuentoDetalle}
                      onChange={(e) => setDescuentoDetalle(e.target.value)}
                    />
                  </label>

                  {calculandoFactura && <p>Calculando...</p>}
                  {errorCalculoFactura && <p className="error">{errorCalculoFactura}</p>}

                  {calculoFactura && !calculandoFactura && (
                    <ul className="detalle-factura-resumen">
                      <li>Subtotal: Bs. {calculoFactura.subtotal.toFixed(2)}</li>
                      <li>IVA (13%): Bs. {calculoFactura.impuesto.toFixed(2)}</li>
                      {calculoFactura.descuento > 0 && <li>Descuento: -Bs. {calculoFactura.descuento.toFixed(2)}</li>}
                      <li className="detalle-factura-total">Total: Bs. {calculoFactura.total.toFixed(2)}</li>
                    </ul>
                  )}
                </div>
              )}

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

              {esEfectivoSimple && (
                <div className="cobro-efectivo">
                  <label className="campo">
                    Monto recibido (Bs.)
                    <input
                      type="number"
                      step="0.01"
                      value={datos.montoRecibido}
                      onChange={(e) => actualizarCampo('montoRecibido', e.target.value)}
                    />
                  </label>

                  <div className="billetes-rapidos">
                    {BILLETES_RAPIDOS.map((valor) => (
                      <button key={valor} type="button" className="billete-rapido" onClick={() => agregarBillete(valor)}>
                        +{valor}
                      </button>
                    ))}
                    {datos.montoRecibido && (
                      <button type="button" className="billete-rapido billete-rapido--limpiar" onClick={() => actualizarCampo('montoRecibido', '')}>
                        Limpiar
                      </button>
                    )}
                  </div>

                  {calculandoVuelto && <p className="ayuda-mixto">Calculando vuelto...</p>}
                  {errorVuelto && <p className="error">{errorVuelto}</p>}
                  {vuelto !== null && !calculandoVuelto && (
                    <p className="vuelto-destacado">Vuelto a entregar: Bs. {vuelto.toFixed(2)}</p>
                  )}
                </div>
              )}

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
                {esEfectivoSimple && (
                  <>
                    <li>Monto recibido: Bs. {datos.montoRecibido}</li>
                    <li>Vuelto a entregar: Bs. {vuelto !== null ? vuelto.toFixed(2) : '-'}</li>
                  </>
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
                  {enviando
                    ? (esQrSimple ? 'Generando QR...' : 'Confirmando...')
                    : (esQrSimple ? 'Generar QR' : 'Confirmar cobro')}
                </button>
              </div>
            </div>
          )}

          {paso === 'esperando-qr' && cobroQr && (
            <div className="cobro-qr-espera">
              <h2>Cobro con QR</h2>
              <img src={urlQrCuenta()} alt="QR de la cuenta del negocio" className="cobro-qr-imagen" />
              <p className="cobro-qr-monto">Bs. {cobroQr.monto}</p>
              <p className="cobro-qr-referencia">Referencia: {cobroQr.referencia}</p>

              {cobroQr.estado === 'Pendiente' && (
                <>
                  <p className="cobro-qr-estado cobro-qr-estado--pendiente">Esperando pago...</p>
                  {segundosRestantes != null && (
                    <p className="cobro-qr-cuenta-regresiva">
                      {segundosRestantes > 0
                        ? `El QR expira en ${formatearTiempoRestante(segundosRestantes)}`
                        : 'Verificando vencimiento...'}
                    </p>
                  )}
                  {errorApi && <p className="error">{errorApi}</p>}
                  <div className="pago-acciones">
                    <button type="button" className="btn btn-secundario" onClick={cancelarCobroQr} disabled={enviando}>
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={confirmarPagoQrRecibido}
                      disabled={enviando || segundosRestantes === 0}
                    >
                      {enviando ? 'Confirmando...' : 'Confirmar pago recibido'}
                    </button>
                  </div>
                </>
              )}

              {cobroQr.estado === 'Pagado' && (
                <>
                  <p className="cobro-qr-estado cobro-qr-estado--pendiente">
                    Pago confirmado. Terminando de registrar la venta...
                  </p>
                  {errorApi && (
                    <>
                      <p className="error">{errorApi}</p>
                      <div className="pago-acciones">
                        <button type="button" className="btn" onClick={reintentarRegistroVentaQr} disabled={enviando}>
                          {enviando ? 'Reintentando...' : 'Reintentar registrar venta'}
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}

              {cobroQr.estado === 'Expirado' && (
                <>
                  <p className="cobro-qr-estado cobro-qr-estado--expirado">
                    El QR expiró (pasaron más de 5 minutos). Genere uno nuevo para cobrar.
                  </p>
                  {errorApi && <p className="error">{errorApi}</p>}
                  <div className="pago-acciones">
                    <button type="button" className="btn btn-secundario" onClick={cancelarCobroQr} disabled={enviando}>
                      Cancelar
                    </button>
                    <button type="button" className="btn" onClick={generarCobroQr} disabled={enviando}>
                      {enviando ? 'Generando...' : 'Regenerar QR'}
                    </button>
                  </div>
                </>
              )}
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
                {pagoRegistrado.monto_recibido != null && (
                  <>
                    <li>Monto recibido: Bs. {pagoRegistrado.monto_recibido}</li>
                    <li>Vuelto entregado: Bs. {pagoRegistrado.vuelto}</li>
                  </>
                )}
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
