import { useState } from 'react'
import { registrarPago } from '../api/pagos.js'

const METODOS_PAGO = ['Efectivo', 'Tarjeta', 'QR']

const ESTADO_INICIAL = {
  idTransaccion: '',
  monto: '',
  metodo: '',
}

function Pagos() {
  const [datos, setDatos] = useState(ESTADO_INICIAL)
  const [paso, setPaso] = useState('formulario') // 'formulario' | 'confirmacion' | 'listo'
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
      <h1>Método de pago</h1>

      {paso === 'formulario' && (
        <form className="pago-form" onSubmit={continuar}>
          <label className="campo">
            ID de transacción
            <input
              type="number"
              value={datos.idTransaccion}
              onChange={(e) => actualizarCampo('idTransaccion', e.target.value)}
            />
          </label>

          <label className="campo">
            Monto (Bs.)
            <input
              type="number"
              step="0.01"
              value={datos.monto}
              onChange={(e) => actualizarCampo('monto', e.target.value)}
            />
          </label>

          <fieldset className="metodo-opciones">
            <legend>Método de pago</legend>
            {METODOS_PAGO.map((metodo) => (
              <label key={metodo} className="metodo-opcion">
                <input
                  type="radio"
                  name="metodo"
                  value={metodo}
                  checked={datos.metodo === metodo}
                  onChange={(e) => actualizarCampo('metodo', e.target.value)}
                />
                {metodo}
              </label>
            ))}
          </fieldset>

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
            <li>ID de transacción: {datos.idTransaccion}</li>
            <li>Monto: Bs. {datos.monto}</li>
            <li>Método de pago: {datos.metodo}</li>
          </ul>

          {errorApi && <p className="error">Error: {errorApi}</p>}

          <div className="pago-acciones">
            <button type="button" className="btn btn-secundario" onClick={cambiarMetodo} disabled={enviando}>
              Cambiar método
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
            <li>Método de pago: {pagoRegistrado.metodo}</li>
            <li>Monto: Bs. {pagoRegistrado.monto}</li>
            <li>Estado: {pagoRegistrado.estado}</li>
            <li>Fecha: {new Date(pagoRegistrado.fecha).toLocaleString()}</li>
          </ul>
          <button type="button" className="btn" onClick={registrarOtro}>
            Registrar otro pago
          </button>
        </div>
      )}
    </section>
  )
}

export default Pagos
