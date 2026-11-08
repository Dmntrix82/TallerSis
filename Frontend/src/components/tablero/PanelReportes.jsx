import { useEffect, useState } from 'react'
import { listarCajas, obtenerReporteCaja, descargarReporteCajaCsv } from '../../api/caja.js'

// TDSI-150 / TDSI-523: "Reportes de caja" con rango de fechas y caja.
// TDSI-524: reporte en pantalla (totales por metodo, turnos y diferencias).
// TDSI-525: boton "Descargar CSV".
// TDSI-526: mensajes de "sin datos" y de error.
//
// Datos: GET /api/caja/reportes?caja_id=&desde=&hasta=[&formato=csv] (gestion_caja).
// El CSV se descarga con los mismos filtros del reporte que esta en pantalla.

const RANGO_MAXIMO_DIAS = 92

const ETIQUETA_TIPO = { CUADRA: 'Cuadra', FALTANTE: 'Faltante', SOBRANTE: 'Sobrante' }
const ETIQUETA_ESTADO_DIFERENCIA = { PENDIENTE: 'Pendiente', RESUELTA: 'Resuelta' }

function hoyLocal() {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

function diasEntre(desde, hasta) {
  return (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000 + 1
}

const bs = (v) => (v === null || v === undefined ? '—' : Number(v).toFixed(2))
const fechaHora = (f) => (f ? new Date(f).toLocaleString() : '—')

function PanelReportes() {
  const [cajas, setCajas] = useState([])
  const [cajaId, setCajaId] = useState('')
  const [desde, setDesde] = useState(hoyLocal)
  const [hasta, setHasta] = useState(hoyLocal)

  const [reporte, setReporte] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [descargando, setDescargando] = useState(false)
  const [errorCsv, setErrorCsv] = useState(null)

  useEffect(() => {
    listarCajas()
      .then((r) => setCajas(r.data))
      .catch(() => setCajas([]))
  }, [])

  async function generar(event) {
    event.preventDefault()
    if (!cajaId) {
      setError('Elija la caja del reporte.')
      return
    }
    if (desde > hasta) {
      setError('La fecha "Desde" no puede ser posterior a "Hasta".')
      return
    }
    if (diasEntre(desde, hasta) > RANGO_MAXIMO_DIAS) {
      setError(`El rango no puede superar ${RANGO_MAXIMO_DIAS} días.`)
      return
    }

    setCargando(true)
    setError(null)
    setErrorCsv(null)
    setReporte(null)
    try {
      const { data } = await obtenerReporteCaja({ caja_id: cajaId, desde, hasta })
      setReporte(data)
    } catch (err) {
      setError(err.mensaje || err.message)
    } finally {
      setCargando(false)
    }
  }

  async function descargarCsv() {
    setDescargando(true)
    setErrorCsv(null)
    try {
      const filtros = { caja_id: reporte.caja_id, desde: reporte.desde, hasta: reporte.hasta }
      const blob = await descargarReporteCajaCsv(filtros)
      const url = URL.createObjectURL(blob)
      const enlace = document.createElement('a')
      enlace.href = url
      enlace.download = `reporte-${filtros.caja_id}-${filtros.desde}-a-${filtros.hasta}.csv`
      document.body.appendChild(enlace)
      enlace.click()
      enlace.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setErrorCsv(err.message)
    } finally {
      setDescargando(false)
    }
  }

  const sinDatos = reporte && reporte.resumen.turnos === 0
  const r = reporte?.resumen

  return (
    <section>
      <h2>Reportes de caja</h2>
      <p className="resumen-turno-actual">
        Operaciones de una caja en un rango de fechas: totales por método de pago, turnos y diferencias.
      </p>

      <form className="filtro-fechas" onSubmit={generar}>
        <label className="campo">
          Caja
          <select
            value={cajaId}
            onChange={(e) => {
              setCajaId(e.target.value)
              setError(null)
            }}
          >
            <option value="">Elija una caja</option>
            {cajas.map((c) => (
              <option key={c.codigo} value={c.codigo}>
                {c.nombre ? `${c.codigo} · ${c.nombre}` : c.codigo}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          Desde
          <input
            type="date"
            value={desde}
            max={hasta || hoyLocal()}
            onChange={(e) => {
              setDesde(e.target.value)
              setError(null)
            }}
          />
        </label>
        <label className="campo">
          Hasta
          <input
            type="date"
            value={hasta}
            min={desde || undefined}
            max={hoyLocal()}
            onChange={(e) => {
              setHasta(e.target.value)
              setError(null)
            }}
          />
        </label>
        <button type="submit" className="btn" disabled={cargando}>
          {cargando ? 'Generando...' : 'Generar reporte'}
        </button>
      </form>

      {cargando && <p>Cargando...</p>}

      {!cargando && error && (
        <div className="orden-mensaje orden-mensaje-error cajas-mensaje">
          <span>{error}</span>
        </div>
      )}

      {!cargando && !error && !reporte && (
        <p className="resumen-turno-actual">Elija una caja y un rango de fechas para generar el reporte.</p>
      )}

      {reporte && (
        <>
          <div className="reporte-encabezado">
            <div>
              <h3>
                {reporte.caja_id}
                {reporte.caja_nombre && ` · ${reporte.caja_nombre}`}
              </h3>
              <p className="tablero-sucursal">
                {reporte.desde === reporte.hasta ? reporte.desde : `${reporte.desde} a ${reporte.hasta}`}
              </p>
            </div>
            {!sinDatos && (
              <button type="button" className="btn btn-azul" onClick={descargarCsv} disabled={descargando}>
                {descargando ? 'Descargando...' : 'Descargar CSV'}
              </button>
            )}
          </div>

          {errorCsv && (
            <p className="orden-mensaje orden-mensaje-error cajas-mensaje">No se pudo descargar el CSV: {errorCsv}</p>
          )}

          {sinDatos ? (
            <p className="orden-mensaje orden-mensaje-pendiente cajas-mensaje">
              No hay datos para esta caja en el rango elegido: no se abrió ningún turno.
            </p>
          ) : (
            <>
              <div className="resumen-cards">
                <div className="resumen-card">
                  <span className="resumen-card-metodo">Total recaudado</span>
                  <span className="resumen-card-total">Bs. {bs(r.total_recaudado)}</span>
                  <span className="resumen-card-cantidad">
                    {r.turnos === 1 ? '1 turno' : `${r.turnos} turnos`}
                  </span>
                </div>
                <div className="resumen-card">
                  <span className="resumen-card-metodo">Ventas</span>
                  <span className="resumen-card-total">{r.ventas}</span>
                  <span className="resumen-card-cantidad">
                    {r.anuladas} anuladas (Bs. {bs(r.monto_anulado)})
                  </span>
                </div>
                <div className="resumen-card">
                  <span className="resumen-card-metodo">Diferencias</span>
                  <span className="resumen-card-total">{r.diferencias}</span>
                  <span className="resumen-card-cantidad">
                    {r.diferencias_pendientes} pendientes · Faltantes Bs. {bs(Math.abs(r.total_faltantes))} · Sobrantes Bs.{' '}
                    {bs(r.total_sobrantes)}
                  </span>
                </div>
              </div>

              <h3 className="reporte-seccion">Totales por método</h3>
              <div className="resumen-cards">
                {reporte.totales_por_metodo.map((m) => (
                  <div key={m.metodo} className="resumen-card">
                    <span className="resumen-card-metodo">{m.metodo}</span>
                    <span className="resumen-card-total">Bs. {bs(m.monto)}</span>
                    <span className="resumen-card-cantidad">
                      {m.operaciones === 1 ? '1 operación' : `${m.operaciones} operaciones`}
                    </span>
                  </div>
                ))}
              </div>

              <h3 className="reporte-seccion">Turnos</h3>
              <div className="reporte-tabla">
                <table className="tabla-facturas">
                  <thead>
                    <tr>
                      <th>Turno</th>
                      <th>Cajero</th>
                      <th>Apertura / cierre</th>
                      <th>Efectivo</th>
                      <th>Tarjeta</th>
                      <th>QR</th>
                      <th>Total</th>
                      <th>Ventas</th>
                      <th>Arqueo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reporte.turnos.map((t) => (
                      <tr key={t.turno_id}>
                        <td>
                          {t.codigo}
                          <span className="solicitud-detalle">{t.estado === 'ABIERTO' ? 'Abierto' : 'Cerrado'}</span>
                        </td>
                        <td>{t.cajero}</td>
                        <td>
                          {fechaHora(t.abierto_en)}
                          <span className="solicitud-detalle">{t.cerrado_en ? fechaHora(t.cerrado_en) : 'Sin cerrar'}</span>
                        </td>
                        <td>{bs(t.por_metodo.Efectivo)}</td>
                        <td>{bs(t.por_metodo.Tarjeta)}</td>
                        <td>{bs(t.por_metodo.QR)}</td>
                        <td><strong>{bs(t.total_recaudado)}</strong></td>
                        <td>
                          {t.ventas}
                          {t.anuladas > 0 && <span className="solicitud-detalle">{t.anuladas} anuladas</span>}
                        </td>
                        <td>
                          {t.tipo_diferencia ? (
                            <>
                              <span className={`badge-estado badge-arqueo--${t.tipo_diferencia.toLowerCase()}`}>
                                {ETIQUETA_TIPO[t.tipo_diferencia] ?? t.tipo_diferencia}
                              </span>
                              <span className="solicitud-detalle">
                                Esperado {bs(t.efectivo_esperado)} · Contado {bs(t.efectivo_contado)}
                              </span>
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3 className="reporte-seccion">Diferencias</h3>
              {reporte.diferencias.length === 0 ? (
                <p className="resumen-turno-actual">No se registraron diferencias en este rango.</p>
              ) : (
                <table className="tabla-facturas">
                  <thead>
                    <tr>
                      <th>Turno</th>
                      <th>Tipo</th>
                      <th>Monto (Bs.)</th>
                      <th>Estado</th>
                      <th>Justificación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reporte.diferencias.map((d) => (
                      <tr key={d.id}>
                        <td>{d.turno_codigo}</td>
                        <td>
                          <span className={`badge-estado badge-arqueo--${d.tipo.toLowerCase()}`}>
                            {ETIQUETA_TIPO[d.tipo] ?? d.tipo}
                          </span>
                        </td>
                        <td>{bs(Math.abs(d.monto))}</td>
                        <td>{ETIQUETA_ESTADO_DIFERENCIA[d.estado] ?? d.estado}</td>
                        <td>
                          {d.justificacion || '—'}
                          {d.resuelta_por && (
                            <span className="solicitud-detalle">
                              Por {d.resuelta_por} · {fechaHora(d.resuelta_en)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </>
      )}
    </section>
  )
}

export default PanelReportes
