import { useEffect, useState } from 'react'
import { listarEgresos, confirmarPagoOrden } from '../api/proveedores.js'

function OrdenesPago() {
  const [usuarioId, setUsuarioId] = useState('')
  const [egresos, setEgresos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [errorLista, setErrorLista] = useState(null)
  const [procesandoId, setProcesandoId] = useState(null)
  const [resultados, setResultados] = useState({})

  useEffect(() => {
    cargarEgresos()
  }, [])

  async function cargarEgresos() {
    setCargando(true)
    setErrorLista(null)
    try {
      setEgresos(await listarEgresos())
    } catch (err) {
      setErrorLista(err.message)
    } finally {
      setCargando(false)
    }
  }

  async function confirmarPago(ordenPagoId) {
    if (!usuarioId.trim()) {
      setResultados((prev) => ({
        ...prev,
        [ordenPagoId]: { tipo: 'error', mensaje: 'Ingrese el usuario que confirma el pago.' },
      }))
      return
    }

    setProcesandoId(ordenPagoId)
    setResultados((prev) => ({ ...prev, [ordenPagoId]: null }))

    try {
      const respuesta = await confirmarPagoOrden(ordenPagoId, usuarioId.trim())
      const pendiente = respuesta.data?.estado === 'PENDIENTE' && respuesta.data?.enviada === false
      const mensaje =
        !pendiente && respuesta.data?.estado
          ? `${respuesta.mensaje} (Estado: ${respuesta.data.estado})`
          : respuesta.mensaje

      setResultados((prev) => ({
        ...prev,
        [ordenPagoId]: { tipo: pendiente ? 'pendiente' : 'exito', mensaje },
      }))
    } catch (err) {
      setResultados((prev) => ({ ...prev, [ordenPagoId]: { tipo: 'error', mensaje: err.message } }))
    } finally {
      setProcesandoId(null)
    }
  }

  return (
    <section>
      <h1>Órdenes de pago liquidadas</h1>

      <label className="campo campo-usuario">
        Usuario que confirma
        <input
          type="text"
          value={usuarioId}
          onChange={(e) => setUsuarioId(e.target.value)}
          placeholder="Ej. U-2"
        />
      </label>

      {cargando && <p>Cargando órdenes...</p>}
      {!cargando && errorLista && <p className="error">{errorLista}</p>}

      {!cargando && !errorLista && (
        egresos.length === 0 ? (
          <p>No hay órdenes liquidadas todavía.</p>
        ) : (
          <ul className="orden-lista">
            {egresos.map((egreso) => {
              const resultado = resultados[egreso.orden_pago_id]
              return (
                <li key={egreso.id} className="orden-item">
                  <div>
                    <strong>{egreso.orden_numero}</strong> — {egreso.proveedor_razon_social}
                    <div className="orden-detalle">
                      Bs. {egreso.monto} · {new Date(egreso.registrado_en).toLocaleString()}
                    </div>
                    {resultado && (
                      <p className={`orden-mensaje orden-mensaje-${resultado.tipo}`}>{resultado.mensaje}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn"
                    disabled={procesandoId === egreso.orden_pago_id}
                    onClick={() => confirmarPago(egreso.orden_pago_id)}
                  >
                    {procesandoId === egreso.orden_pago_id ? 'Confirmando...' : 'Confirmar pago realizado'}
                  </button>
                </li>
              )
            })}
          </ul>
        )
      )}
    </section>
  )
}

export default OrdenesPago
