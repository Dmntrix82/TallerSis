import { useState } from 'react'
import { guardarCliente } from '../api/clientes.js'

const NIT_REGEX = /^\d{6,15}$/

const ESTADO_INICIAL = {
  nit: '',
  razon_social: '',
}

// TDSI-284: mismas reglas de formato que valida el backend (facturacion/clientesService.js).
function validarDatosCliente({ nit, razon_social }) {
  if (!nit || !razon_social) {
    return "Complete el NIT y la Razón Social, o elija 'Sin Factura'."
  }
  if (!NIT_REGEX.test(nit)) {
    return 'El NIT debe tener entre 6 y 15 dígitos numéricos.'
  }
  if (razon_social.length > 150) {
    return 'La razón social no puede superar 150 caracteres.'
  }
  return null
}

// TDSI-90: formulario de datos de facturación (NIT / Razón Social).
function Facturacion() {
  const [tipoVenta, setTipoVenta] = useState(null) // TDSI-285: 'SIN_FACTURA' | 'CON_NIT'
  const [datos, setDatos] = useState(ESTADO_INICIAL)
  const [paso, setPaso] = useState('formulario') // 'formulario' | 'confirmacion' | 'listo'
  const [errorValidacion, setErrorValidacion] = useState(null)
  const [errorApi, setErrorApi] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [clienteGuardado, setClienteGuardado] = useState(null)

  function elegirTipoVenta(tipo) {
    setTipoVenta(tipo)
    setErrorValidacion(null)
    if (tipo === 'SIN_FACTURA') {
      setDatos(ESTADO_INICIAL)
    }
  }

  function actualizarCampo(campo, valor) {
    setDatos((prev) => ({ ...prev, [campo]: valor }))
  }

  function continuar(event) {
    event.preventDefault()

    if (!tipoVenta) {
      setErrorValidacion("Elija si la venta es 'Sin Factura' o 'Con NIT'.")
      return
    }

    if (tipoVenta === 'CON_NIT') {
      const mensaje = validarDatosCliente(datos)
      if (mensaje) {
        setErrorValidacion(mensaje)
        return
      }
    }

    setErrorValidacion(null)
    setPaso('confirmacion')
  }

  function editarDatos() {
    setErrorApi(null)
    setPaso('formulario')
  }

  // TDSI-286: los datos ya se mostraron en el paso de confirmación; aquí solo se guardan.
  async function confirmarFactura() {
    if (tipoVenta === 'SIN_FACTURA') {
      setClienteGuardado(null)
      setPaso('listo')
      return
    }

    setEnviando(true)
    setErrorApi(null)

    try {
      const respuesta = await guardarCliente(datos)
      setClienteGuardado(respuesta.data)
      setPaso('listo')
    } catch (err) {
      setErrorApi(err.message)
    } finally {
      setEnviando(false)
    }
  }

  function registrarOtra() {
    setTipoVenta(null)
    setDatos(ESTADO_INICIAL)
    setClienteGuardado(null)
    setPaso('formulario')
  }

  return (
    <section>
      <h1>Datos de facturación</h1>

      {paso === 'formulario' && (
        <form className="factura-form" onSubmit={continuar}>
          <div className="tipo-venta-opciones">
            <button
              type="button"
              className={`tipo-venta-opcion${tipoVenta === 'SIN_FACTURA' ? ' activa' : ''}`}
              onClick={() => elegirTipoVenta('SIN_FACTURA')}
            >
              Sin Factura
            </button>
            <button
              type="button"
              className={`tipo-venta-opcion${tipoVenta === 'CON_NIT' ? ' activa' : ''}`}
              onClick={() => elegirTipoVenta('CON_NIT')}
            >
              Con NIT
            </button>
          </div>

          {tipoVenta === 'CON_NIT' && (
            <>
              <label className="campo">
                NIT
                <input
                  type="text"
                  inputMode="numeric"
                  value={datos.nit}
                  onChange={(e) => actualizarCampo('nit', e.target.value)}
                />
              </label>

              <label className="campo">
                Razón social
                <input
                  type="text"
                  value={datos.razon_social}
                  onChange={(e) => actualizarCampo('razon_social', e.target.value)}
                />
              </label>
            </>
          )}

          {errorValidacion && <p className="error">{errorValidacion}</p>}

          <button type="submit" className="btn">
            Continuar
          </button>
        </form>
      )}

      {paso === 'confirmacion' && (
        <div className="factura-resumen">
          <h2>Confirmar datos de facturación</h2>
          <ul>
            <li>Tipo de venta: {tipoVenta === 'CON_NIT' ? 'Con NIT' : 'Sin Factura'}</li>
            {tipoVenta === 'CON_NIT' && (
              <>
                <li>NIT: {datos.nit}</li>
                <li>Razón social: {datos.razon_social}</li>
              </>
            )}
          </ul>

          {errorApi && <p className="error">Error: {errorApi}</p>}

          <div className="factura-acciones">
            <button type="button" className="btn btn-secundario" onClick={editarDatos} disabled={enviando}>
              Editar
            </button>
            <button type="button" className="btn" onClick={confirmarFactura} disabled={enviando}>
              {enviando ? 'Confirmando...' : 'Confirmar factura'}
            </button>
          </div>
        </div>
      )}

      {paso === 'listo' && (
        <div className="factura-exito">
          <h2>Datos de facturación listos</h2>
          <ul>
            <li>Tipo de venta: {tipoVenta === 'CON_NIT' ? 'Con NIT' : 'Sin Factura'}</li>
            {clienteGuardado && (
              <>
                <li>NIT: {clienteGuardado.nit}</li>
                <li>Razón social: {clienteGuardado.razon_social}</li>
              </>
            )}
          </ul>
          <button type="button" className="btn" onClick={registrarOtra}>
            Registrar otra venta
          </button>
        </div>
      )}
    </section>
  )
}

export default Facturacion
