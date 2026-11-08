import { useEffect, useState } from 'react'
import { obtenerAvanceMetas, definirMeta } from '../api/metas.js'
import { useAdminAuth } from '../context/AdminAuthContext.jsx'

function hoyLocal() {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

const bs = (v) => Number(v ?? 0).toFixed(2)

// TDSI-58: la tarjeta muestra "Vendido hoy" solo si la fecha elegida es hoy; para
// cualquier otra fecha muestra el dia elegido, para no decir "hoy" de un dia pasado.
function etiquetaVendido(fecha) {
  if (fecha === hoyLocal()) return 'Vendido hoy'
  const [anio, mes, dia] = fecha.split('-')
  return `Vendido el ${dia}/${mes}/${anio}`
}

function colorAvance(porcentaje) {
  if (porcentaje >= 100) return '#166534' // verde
  if (porcentaje >= 50) return '#92400e' // amarillo/ambar
  return '#b91c1c' // rojo
}

// TDSI-194/777-780: pantalla "Metas de venta" del Administrador -- una tarjeta por
// caja con su meta diaria, lo vendido y una barra de avance.
function MetasVenta() {
  const { administrador } = useAdminAuth()

  const [fecha, setFecha] = useState(hoyLocal)
  const [cajas, setCajas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [recargar, setRecargar] = useState(0)

  const [editando, setEditando] = useState(null) // { caja_id, caja_nombre, meta } | null
  const [monto, setMonto] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errorEditar, setErrorEditar] = useState(null)

  useEffect(() => {
    let vigente = true
    setCargando(true)
    setError(null)
    obtenerAvanceMetas(fecha)
      .then((r) => vigente && setCajas(r.data))
      .catch((err) => vigente && setError(err.mensaje || err.message))
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [fecha, recargar])

  function abrirEditar(caja) {
    setEditando(caja)
    setMonto(typeof caja.meta === 'number' ? String(caja.meta) : '')
    setErrorEditar(null)
  }

  async function confirmarEditar(event) {
    event.preventDefault()
    const montoNum = Number(monto)
    if (!monto || !(montoNum > 0)) {
      setErrorEditar('La meta debe ser un monto mayor a 0.')
      return
    }
    setGuardando(true)
    setErrorEditar(null)
    try {
      await definirMeta(editando.caja_id, { monto: montoNum, actualizado_por: administrador?.nombre })
      setEditando(null)
      setRecargar((n) => n + 1)
    } catch (err) {
      setErrorEditar(err.mensaje || err.message)
    } finally {
      setGuardando(false)
    }
  }

  const montoValido = Number(monto) > 0

  return (
    <section>
      <h1>Metas de venta</h1>
      <p className="resumen-turno-actual">Meta de venta diaria de cada caja y el avance del día.</p>

      <div className="filtro-fechas">
        <label className="campo">
          Fecha
          <input type="date" value={fecha} max={hoyLocal()} onChange={(e) => setFecha(e.target.value)} />
        </label>
      </div>

      {cargando && <p>Cargando...</p>}
      {!cargando && error && <p className="error">Error: {error}</p>}

      {!cargando && !error && cajas.length === 0 && (
        <p className="orden-mensaje orden-mensaje-pendiente cajas-mensaje">No hay cajas registradas.</p>
      )}

      {!cargando && !error && cajas.length > 0 && (
        <div className="cajas-grid">
          {cajas.map((c) => {
            const sinMeta = c.meta === 'sin meta'
            const porcentaje = sinMeta ? 0 : c.porcentaje
            return (
              <article key={c.caja_id} className="caja-card">
                <div className="caja-card-encabezado">
                  <span className="caja-card-codigo">{c.caja_id}</span>
                  <span className="caja-card-nombre">{c.caja_nombre || 'Sin nombre'}</span>
                </div>

                <p className="caja-card-detalle">{etiquetaVendido(fecha)}: Bs. {bs(c.vendido)}</p>

                {sinMeta ? (
                  <>
                    <p className="caja-card-detalle">Sin meta</p>
                    <button type="button" className="btn btn-secundario" onClick={() => abrirEditar(c)}>
                      Definir meta
                    </button>
                  </>
                ) : (
                  <>
                    <p className="caja-card-detalle">Meta: Bs. {bs(c.meta)}</p>
                    <div style={{ background: '#e4e7eb', borderRadius: '999px', overflow: 'hidden', height: '10px', margin: '0.5rem 0' }}>
                      <div
                        style={{
                          width: `${Math.min(porcentaje, 100)}%`,
                          height: '100%',
                          backgroundColor: colorAvance(porcentaje),
                        }}
                      />
                    </div>
                    <p className="caja-card-detalle" style={{ color: colorAvance(porcentaje), fontWeight: 600 }}>
                      {porcentaje.toFixed(1)}%
                    </p>
                    <button type="button" className="btn btn-secundario" onClick={() => abrirEditar(c)}>
                      Editar meta
                    </button>
                  </>
                )}
              </article>
            )
          })}
        </div>
      )}

      {editando && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Editar meta">
          <form className="modal-caja" onSubmit={confirmarEditar}>
            <h2>{editando.meta === 'sin meta' ? 'Definir meta' : 'Editar meta'}</h2>
            <p>{editando.caja_id} {editando.caja_nombre ? `· ${editando.caja_nombre}` : ''}</p>

            <label className="campo">
              Meta de venta diaria (Bs.)
              <input
                type="number"
                step="0.01"
                min="0"
                value={monto}
                onChange={(e) => {
                  setMonto(e.target.value)
                  setErrorEditar(null)
                }}
                autoFocus
              />
            </label>

            {errorEditar && <p className="error">{errorEditar}</p>}

            <div className="pago-exito-acciones">
              <button type="button" className="btn btn-secundario" onClick={() => setEditando(null)} disabled={guardando}>
                Cancelar
              </button>
              <button type="submit" className="btn" disabled={guardando || !montoValido}>
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}

export default MetasVenta
