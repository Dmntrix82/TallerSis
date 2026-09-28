import { useState } from 'react'
import { obtenerOrdenPago, registrarEgreso } from '../api/egresos.js'
import { useAuth } from '../context/AuthContext.jsx'

const METODOS_PAGO = ['TRANSFERENCIA', 'CHEQUE', 'EFECTIVO']

// TDSI-118: formulario de registro de egreso por pago a un proveedor.
function EgresoProveedor() {
  const { cajero } = useAuth()

  const [numeroOrden, setNumeroOrden] = useState('')
  const [orden, setOrden] = useState(null) // TDSI-404: orden encontrada, con su monto pendiente
  const [buscando, setBuscando] = useState(false)
  const [errorBusqueda, setErrorBusqueda] = useState(null)

  const [monto, setMonto] = useState('')
  const [metodo, setMetodo] = useState('TRANSFERENCIA')
  const [descripcion, setDescripcion] = useState('')
  const [errorValidacion, setErrorValidacion] = useState(null)
  const [errorApi, setErrorApi] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [egresoRegistrado, setEgresoRegistrado] = useState(null)

  async function buscarOrden(event) {
    event.preventDefault()

    if (!numeroOrden.trim()) {
      setErrorBusqueda('Ingrese el número de la orden de pago.')
      return
    }

    setErrorBusqueda(null)
    setBuscando(true)
    try {
      const respuesta = await obtenerOrdenPago(numeroOrden.trim())
      const encontrada = respuesta.data

      if (encontrada.estado !== 'PENDIENTE') {
        setErrorBusqueda(`La orden "${encontrada.numero}" ya fue liquidada, no tiene pago pendiente.`)
        setOrden(null)
        return
      }

      setOrden(encontrada)
      setMonto(String(Number(encontrada.monto)))
      setErrorValidacion(null)
      setErrorApi(null)
      setEgresoRegistrado(null)
    } catch (err) {
      setErrorBusqueda(err.message)
      setOrden(null)
    } finally {
      setBuscando(false)
    }
  }

  function buscarOtra() {
    setOrden(null)
    setNumeroOrden('')
    setErrorBusqueda(null)
  }

  async function confirmarEgreso(event) {
    event.preventDefault()

    const montoNumero = Number(monto)
    if (!monto || Number.isNaN(montoNumero) || montoNumero <= 0) {
      setErrorValidacion('Ingrese un monto válido.')
      return
    }
    // TDSI-406: el monto pagado debe coincidir con lo adeudado en la orden.
    const montoAdeudado = Number(orden.monto)
    if (Math.abs(montoAdeudado - montoNumero) > 0.01) {
      setErrorValidacion(
        `El monto ingresado (${montoNumero.toFixed(2)}) no coincide con lo adeudado (${montoAdeudado.toFixed(2)}).`,
      )
      return
    }

    setErrorValidacion(null)
    setErrorApi(null)
    setEnviando(true)

    try {
      const respuesta = await registrarEgreso({
        orden_pago_id: orden.id,
        monto: montoNumero,
        metodo,
        descripcion: descripcion.trim() || undefined,
        registrado_por: cajero?.nombre,
      })
      setEgresoRegistrado(respuesta.data)
    } catch (err) {
      // TDSI-406: tambien cubre el caso en que el backend rechace el monto (por si cambia entre medio)
      setErrorApi(err.message)
    } finally {
      setEnviando(false)
    }
  }

  function registrarOtro() {
    setOrden(null)
    setNumeroOrden('')
    setMonto('')
    setMetodo('TRANSFERENCIA')
    setDescripcion('')
    setEgresoRegistrado(null)
  }

  return (
    <section>
      <h1>Registrar egreso a proveedor</h1>

      {!orden && !egresoRegistrado && (
        <form className="egreso-buscar" onSubmit={buscarOrden}>
          <label className="campo">
            Número de orden de pago
            <input
              type="text"
              placeholder="Ej. OP-0001"
              value={numeroOrden}
              onChange={(e) => setNumeroOrden(e.target.value)}
            />
          </label>

          {errorBusqueda && <p className="error">Error: {errorBusqueda}</p>}

          <button type="submit" className="btn" disabled={buscando}>
            {buscando ? 'Buscando...' : 'Buscar orden'}
          </button>
        </form>
      )}

      {orden && !egresoRegistrado && (
        <form className="egreso-form" onSubmit={confirmarEgreso}>
          {/* TDSI-404: monto pendiente de la orden antes de confirmar el pago */}
          <div className="egreso-orden-info">
            <p>
              <strong>Orden:</strong> {orden.numero}
            </p>
            <p>
              <strong>Proveedor:</strong> {orden.proveedor_razon_social}
            </p>
            <p>
              <strong>Monto adeudado:</strong> Bs. {Number(orden.monto).toFixed(2)}
            </p>
          </div>

          <label className="campo">
            Monto a pagar (Bs.)
            <input type="number" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} />
          </label>

          <fieldset className="metodo-opciones">
            <legend>Método de pago</legend>
            {METODOS_PAGO.map((m) => (
              <label key={m} className="metodo-opcion">
                <input
                  type="radio"
                  name="metodo"
                  value={m}
                  checked={metodo === m}
                  onChange={(e) => setMetodo(e.target.value)}
                />
                {m}
              </label>
            ))}
          </fieldset>

          <label className="campo">
            Descripción (opcional)
            <textarea rows={3} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </label>

          {/* TDSI-406 */}
          {errorValidacion && <p className="error">{errorValidacion}</p>}
          {errorApi && <p className="error">Error: {errorApi}</p>}

          <div className="egreso-acciones">
            <button type="button" className="btn btn-secundario" onClick={buscarOtra} disabled={enviando}>
              Buscar otra orden
            </button>
            <button type="submit" className="btn" disabled={enviando}>
              {enviando ? 'Registrando...' : 'Registrar egreso'}
            </button>
          </div>
        </form>
      )}

      {/* TDSI-405: mensaje de confirmación al registrar el egreso */}
      {egresoRegistrado && (
        <div className="egreso-exito">
          <p className="mensaje-exito">
            Egreso registrado: Bs. {Number(egresoRegistrado.egreso.monto).toFixed(2)} a{' '}
            {orden.proveedor_razon_social} ({egresoRegistrado.egreso.metodo}). La orden{' '}
            {egresoRegistrado.orden.numero} quedó liquidada.
          </p>
          <button type="button" className="btn" onClick={registrarOtro}>
            Registrar otro egreso
          </button>
        </div>
      )}
    </section>
  )
}

export default EgresoProveedor
