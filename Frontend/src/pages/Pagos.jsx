import { useState } from 'react'
import { registrarPago, enviarFacturaPorCorreo } from '../api/pagos.js'
import PagoMixtoForm from '../components/PagoMixtoForm.jsx'

const METODOS_PAGO = ['Efectivo', 'Tarjeta', 'QR']

const ESTADO_INICIAL = {
  idTransaccion: '',
  monto: '',
  metodo: '',
}

function EnviarFacturaPorCorreo({ idTransaccion }) {
  const [quiere, setQuiere] = useState(null)
  const [email, setEmail] = useState('')
  const [errorValidacion, setErrorValidacion] = useState(null)
  const [errorApi, setErrorApi] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState(null)

  async function enviar(event) {
    event.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorValidacion('Ingrese un correo válido.')
      return
    }
    setErrorValidacion(null)
    setErrorApi(null)
    setEnviando(true)
    try {
      const respuesta = await enviarFacturaPorCorreo(idTransaccion, email.trim())
      setResultado(respuesta.mensaje)
    } catch (err) {
      setErrorApi(err.message)
    } finally {
      setEnviando(false)
    }
  }

  if (quiere === null) {
    return (
      <div className="factura-correo">
        <p>¿Desea recibir la factura por correo?</p>
        <div className="factura-correo-acciones">
          <button type="button" className="btn btn-secundario" onClick={() => setQuiere(false)}>No</button>
          <button type="button" className="btn" onClick={() => setQuiere(true)}>Sí, enviar por correo</button>
        </div>
      </div>
    )
  }

  if (quiere === false || resultado) {
    return (
      <div className="factura-correo">
        {resultado && <p className="mensaje-exito">{resultado}</p>}
      </div>
    )
  }

  return (
    <form className="factura-correo" onSubmit={enviar}>
      <label className="campo">
        Correo del cliente
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      {errorValidacion && <p className="error">{errorValidacion}</p>}
      {errorApi && <p className="error">Error: {errorApi}</p>}
      <div className="factura-correo-acciones">
        <button type="button" className="btn btn-secundario" onClick={() => setQuiere(null)} disabled={enviando}>Volver</button>
        <button type="submit" className="btn" disabled={enviando}>{enviando ? 'Enviando...' : 'Enviar factura'}</button>
      </div>
    </form>
  )
}

function Pagos() {
  const [tipoPago, setTipoPago] = useState('simple')
  const [datos, setDatos] = useState(ESTADO_INICIAL)
  const [paso, setPaso] = useState('formulario')
  const [errorValidacion, setErrorValidacion] = useState(null)
  const [errorApi, setErrorApi] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [pagoRegistrado, setPagoRegistrado] = useState(null)

  function actualizarCampo(campo, valor) {
    setDatos((prev) => ({ ...prev, [campo]: valor }))
  }

  function continuar(event) {
    event.preventDefault()
    if (!datos.idTransaccion || !datos.monto) {
      setErrorValidacion('Complete el ID de transacción y el monto.')
      return
    }
    if (!datos.metodo) {
      setErrorValidacion('Debe seleccionar un método de pago antes de continuar.')
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
    try {
      const respuesta = await registrarPago({
        id_transaccion: Number(datos.idTransaccion),
        metodo: datos.metodo,
        monto: Number(datos.monto),
      })
      setPagoRegistrado(respuesta.pago)
      setPaso('listo')
    } catch (err) {
      setErrorApi(err.message)
    } finally {
      setEnviando(false)
    }
  }

  function registrarOtro() {
    setDatos(ESTADO_INICIAL)
    setPagoRegistrado(null)
    setPaso('formulario')
  }

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Método de pago</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => setTipoPago('simple')} className="btn" style={{ opacity: tipoPago === 'simple' ? 1 : 0.6 }}>
            Pago Simple
          </button>
          <button onClick={() => setTipoPago('mixto')} className="btn" style={{ opacity: tipoPago === 'mixto' ? 1 : 0.6 }}>
            Pago Mixto
          </button>
        </div>
      </div>

      {tipoPago === 'mixto' ? (
        <PagoMixtoForm />
      ) : (
        <>
          {paso === 'formulario' && (
            <form className="pago-form" onSubmit={continuar}>
              <label className="campo">
                ID de transacción
                <input type="number" value={datos.idTransaccion} onChange={(e) => actualizarCampo('idTransaccion', e.target.value)} />
              </label>
              <label className="campo">
                Monto (Bs.)
                <input type="number" step="0.01" value={datos.monto} onChange={(e) => actualizarCampo('monto', e.target.value)} />
              </label>
              <fieldset className="metodo-opciones">
                <legend>Método de pago</legend>
                {METODOS_PAGO.map((metodo) => (
                  <label key={metodo} className="metodo-opcion">
                    <input type="radio" name="metodo" value={metodo} checked={datos.metodo === metodo} onChange={(e) => actualizarCampo('metodo', e.target.value)} />
                    {metodo}
                  </label>
                ))}
              </fieldset>
              {errorValidacion && <p className="error">{errorValidacion}</p>}
              <button type="submit" className="btn">Continuar</button>
            </form>
          )}

          {paso === 'confirmacion' && (
            <div className="pago-resumen">
              <h2>Confirmar cobro</h2>
              <ul>
                <li>ID de transacción: {datos.idTransaccion}</li>
                <li>Monto: Bs. {datos.monto}</li>
                <li>Método de pago: {datos.metodo}</li>
              </ul>
              {errorApi && <p className="error">Error: {errorApi}</p>}
              <div className="pago-acciones">
                <button type="button" className="btn btn-secundario" onClick={cambiarMetodo} disabled={enviando}>Cambiar método</button>
                <button type="button" className="btn" onClick={confirmarCobro} disabled={enviando}>{enviando ? 'Confirmando...' : 'Confirmar cobro'}</button>
              </div>
            </div>
          )}

          {paso === 'listo' && pagoRegistrado && (
            <div className="pago-exito">
              <h2>Pago registrado</h2>
              <ul>
                <li>ID de transacción: {pagoRegistrado.id_transaccion}</li>
                <li>Método de pago: {pagoRegistrado.metodo}</li>
                <li>Monto: Bs. {pagoRegistrado.monto}</li>
                <li>Estado: {pagoRegistrado.estado}</li>
                <li>Fecha: {new Date(pagoRegistrado.fecha).toLocaleString()}</li>
              </ul>
              <EnviarFacturaPorCorreo idTransaccion={pagoRegistrado.id_transaccion} />
              <button type="button" className="btn" onClick={registrarOtro}>Registrar otro pago</button>
            </div>
          )}
        </>
      )}
    </section>
  )
}

export default Pagos