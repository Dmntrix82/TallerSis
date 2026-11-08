import { useEffect, useState } from 'react'
import { obtenerProductosVendidos, enviarProductosACompras } from '../api/productosVendidos.js'

function hoyLocal() {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

const bs = (v) => Number(v ?? 0).toFixed(2)

const ETIQUETA_ENVIO = { Enviado: 'Enviado', Recibido: 'Recibido por Compras', Error: 'Error' }
const CLASE_ENVIO = { Enviado: 'badge-estado', Recibido: 'badge-estado--emitida', Error: 'badge-comparacion--faltante' }

// TDSI-186/712-715: pantalla "Productos Vendidos" del Administrador -- productos del
// dia (solo ventas del Marketplace, que son las unicas con desglose por item) y el
// envio del reporte diario a Compras.
function ProductosVendidos() {
  const [fecha, setFecha] = useState(hoyLocal)
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [recargar, setRecargar] = useState(0)

  const [confirmando, setConfirmando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState(null)
  const [mensaje, setMensaje] = useState(null)

  useEffect(() => {
    let vigente = true
    setCargando(true)
    setError(null)
    setMensaje(null)
    obtenerProductosVendidos(fecha)
      .then((r) => vigente && setDatos(r.data))
      .catch((err) => vigente && setError(err.mensaje || err.message))
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [fecha, recargar])

  const hayProductos = datos && datos.productos.length > 0
  const totalUnidades = hayProductos ? datos.productos.reduce((acc, p) => acc + p.cantidad, 0) : 0
  const totalMonto = hayProductos ? datos.productos.reduce((acc, p) => acc + p.monto, 0) : 0

  // TDSI-719/720: ya se envio con exito (Enviado o Recibido) o no hay nada que enviar.
  const yaEnviado = datos?.envio && datos.envio.estado !== 'Error'
  const puedeEnviar = hayProductos && !yaEnviado

  async function confirmarEnvio() {
    setEnviando(true)
    setErrorEnvio(null)
    try {
      await enviarProductosACompras(fecha)
      setConfirmando(false)
      setMensaje('Reporte enviado a Compras.')
      setRecargar((n) => n + 1)
    } catch (err) {
      setErrorEnvio(err.mensaje || err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section>
      <h1>Productos Vendidos</h1>
      <p className="resumen-turno-actual">
        Productos vendidos en el día (ventas del Marketplace) y el envío del reporte diario a Compras.
      </p>

      <div className="filtro-fechas">
        <label className="campo">
          Fecha
          <input type="date" value={fecha} max={hoyLocal()} onChange={(e) => setFecha(e.target.value)} />
        </label>
        <button type="button" className="btn" onClick={() => setConfirmando(true)} disabled={!puedeEnviar}>
          Enviar a Compras
        </button>
        {datos?.envio && (
          <span className={`badge-estado ${CLASE_ENVIO[datos.envio.estado] ?? ''}`}>
            {ETIQUETA_ENVIO[datos.envio.estado] ?? datos.envio.estado}
          </span>
        )}
      </div>

      {datos?.envio?.estado === 'Error' && (
        <p className="error">No se pudo enviar el reporte: {datos.envio.ultimoError}</p>
      )}
      {datos?.envio?.enviadoEn && (
        <p className="resumen-turno-actual" style={{ marginTop: '-0.5rem' }}>
          Enviado el {new Date(datos.envio.enviadoEn).toLocaleString()}
          {datos.envio.recibidoEn && ` · Recibido el ${new Date(datos.envio.recibidoEn).toLocaleString()}`}
        </p>
      )}

      {mensaje && <p className="mensaje-exito">{mensaje}</p>}

      {cargando && <p>Cargando...</p>}
      {!cargando && error && <p className="error">Error: {error}</p>}

      {!cargando && !error && !hayProductos && (
        <p className="orden-mensaje orden-mensaje-pendiente cajas-mensaje">No hubo ventas en esta fecha.</p>
      )}

      {!cargando && !error && hayProductos && (
        <div className="reporte-tabla">
          <table className="tabla-facturas">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Monto (Bs.)</th>
              </tr>
            </thead>
            <tbody>
              {datos.productos.map((p) => (
                <tr key={p.sku}>
                  <td>{p.descripcion || p.sku}</td>
                  <td>{p.cantidad}</td>
                  <td>{bs(p.monto)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td><strong>Total</strong></td>
                <td><strong>{totalUnidades}</strong></td>
                <td><strong>{bs(totalMonto)}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {confirmando && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Confirmar envío a Compras">
          <div className="modal-caja">
            <h2>¿Enviar a Compras?</h2>
            <p>
              Se va a enviar el reporte de productos vendidos del {fecha} ({totalUnidades} unidades, Bs. {bs(totalMonto)}) a Compras.
            </p>

            {errorEnvio && <p className="error">{errorEnvio}</p>}

            <div className="pago-exito-acciones">
              <button type="button" className="btn btn-secundario" onClick={() => setConfirmando(false)} disabled={enviando}>
                Cancelar
              </button>
              <button type="button" className="btn" onClick={confirmarEnvio} disabled={enviando}>
                {enviando ? 'Enviando...' : 'Sí, enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default ProductosVendidos
