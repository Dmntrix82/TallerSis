import { useEffect, useState } from 'react'
import { obtenerComparativoMensual } from '../api/tablero.js'

const MESES = [
  { valor: 1, etiqueta: 'Enero' }, { valor: 2, etiqueta: 'Febrero' }, { valor: 3, etiqueta: 'Marzo' },
  { valor: 4, etiqueta: 'Abril' }, { valor: 5, etiqueta: 'Mayo' }, { valor: 6, etiqueta: 'Junio' },
  { valor: 7, etiqueta: 'Julio' }, { valor: 8, etiqueta: 'Agosto' }, { valor: 9, etiqueta: 'Septiembre' },
  { valor: 10, etiqueta: 'Octubre' }, { valor: 11, etiqueta: 'Noviembre' }, { valor: 12, etiqueta: 'Diciembre' },
]
const NOMBRE_MES = Object.fromEntries(MESES.map((m) => [m.valor, m.etiqueta]))

const hoy = new Date()
const bs = (v) => Number(v ?? 0).toFixed(2)

function Variacion({ valor }) {
  if (valor === null || valor === undefined) {
    return <span className="resumen-turno-actual" style={{ fontSize: '0.85rem' }}>Sin datos del mes anterior</span>
  }
  const color = valor > 0 ? '#166534' : valor < 0 ? '#b91c1c' : '#616e7c'
  const signo = valor > 0 ? '+' : ''
  return <strong style={{ color }}>{signo}{valor.toFixed(2)}%</strong>
}

// TDSI-190/738-741: pantalla "Comparativo mensual" del Administrador -- total del mes
// elegido vs. el mes anterior, por caja y por metodo de pago, con la variacion en %.
function ComparativoMensual() {
  const [mes, setMes] = useState(hoy.getMonth() + 1)
  const [anio, setAnio] = useState(hoy.getFullYear())

  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let vigente = true
    setCargando(true)
    setError(null)
    obtenerComparativoMensual(mes, anio)
      .then((r) => vigente && setDatos(r.data))
      .catch((err) => vigente && setError(err.mensaje || err.message))
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [mes, anio])

  return (
    <section>
      <h1>Comparativo mensual</h1>
      <p className="resumen-turno-actual">
        Total vendido del mes elegido contra el mes anterior, por caja y por método de pago.
      </p>

      <div className="filtro-fechas">
        <label className="campo campo-turno-dia">
          Mes
          <select value={mes} onChange={(e) => setMes(Number(e.target.value))}>
            {MESES.map((m) => (
              <option key={m.valor} value={m.valor}>{m.etiqueta}</option>
            ))}
          </select>
        </label>
        <label className="campo campo-turno-dia">
          Año
          <input type="number" min="2000" max="2100" value={anio} onChange={(e) => setAnio(Number(e.target.value))} />
        </label>
      </div>

      {cargando && <p>Cargando...</p>}
      {!cargando && error && <p className="error">Error: {error}</p>}

      {!cargando && !error && datos && (
        <>
          {datos.comparadoPorMismosDias && (
            <p className="resumen-turno-actual">
              Como es el mes en curso, se compara contra los mismos días de {NOMBRE_MES[datos.mesAnterior]}.
            </p>
          )}

          <div className="resumen-cards">
            <div className="resumen-card">
              <span className="resumen-card-metodo">{NOMBRE_MES[datos.mes]} {datos.anio}</span>
              <span className="resumen-card-total">Bs. {bs(datos.total.actual)}</span>
            </div>
            <div className="resumen-card">
              <span className="resumen-card-metodo">{NOMBRE_MES[datos.mesAnterior]} {datos.anioAnterior}</span>
              <span className="resumen-card-total">Bs. {bs(datos.total.anterior)}</span>
            </div>
            <div className="resumen-card">
              <span className="resumen-card-metodo">Variación</span>
              <span className="resumen-card-total"><Variacion valor={datos.total.variacion} /></span>
            </div>
          </div>

          <h2 className="reporte-seccion">Por caja</h2>
          <table className="tabla-facturas">
            <thead>
              <tr>
                <th>Caja</th>
                <th>{NOMBRE_MES[datos.mes]} (Bs.)</th>
                <th>{NOMBRE_MES[datos.mesAnterior]} (Bs.)</th>
                <th>Variación</th>
              </tr>
            </thead>
            <tbody>
              {datos.porCaja.map((c) => (
                <tr key={c.caja_id}>
                  <td>{c.caja_id}</td>
                  <td>{bs(c.actual)}</td>
                  <td>{bs(c.anterior)}</td>
                  <td><Variacion valor={c.variacion} /></td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 className="reporte-seccion">Por método de pago</h2>
          <table className="tabla-facturas">
            <thead>
              <tr>
                <th>Método</th>
                <th>{NOMBRE_MES[datos.mes]} (Bs.)</th>
                <th>{NOMBRE_MES[datos.mesAnterior]} (Bs.)</th>
                <th>Variación</th>
              </tr>
            </thead>
            <tbody>
              {datos.porMetodo.map((m) => (
                <tr key={m.metodo}>
                  <td>{m.metodo}</td>
                  <td>{bs(m.actual)}</td>
                  <td>{bs(m.anterior)}</td>
                  <td><Variacion valor={m.variacion} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  )
}

export default ComparativoMensual
