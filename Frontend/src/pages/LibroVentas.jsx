import { useEffect, useState } from 'react'
import { obtenerLibroVentas, descargarLibroVentasExcel } from '../api/libroVentas.js'

const MESES = [
  { valor: 1, etiqueta: 'Enero' },
  { valor: 2, etiqueta: 'Febrero' },
  { valor: 3, etiqueta: 'Marzo' },
  { valor: 4, etiqueta: 'Abril' },
  { valor: 5, etiqueta: 'Mayo' },
  { valor: 6, etiqueta: 'Junio' },
  { valor: 7, etiqueta: 'Julio' },
  { valor: 8, etiqueta: 'Agosto' },
  { valor: 9, etiqueta: 'Septiembre' },
  { valor: 10, etiqueta: 'Octubre' },
  { valor: 11, etiqueta: 'Noviembre' },
  { valor: 12, etiqueta: 'Diciembre' },
]

const ETIQUETA_ESTADO = { V: 'Vigente', A: 'Anulada' }

const hoy = new Date()

const bs = (v) => Number(v ?? 0).toFixed(2)

// TDSI-178/751-754: pantalla "Libro de Ventas" del Administrador -- IVA del mes
// elegido, con vista previa en tabla y descarga del mismo libro en Excel.
function LibroVentas() {
  const [mes, setMes] = useState(hoy.getMonth() + 1)
  const [anio, setAnio] = useState(hoy.getFullYear())

  const [libro, setLibro] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const [descargando, setDescargando] = useState(false)
  const [errorDescarga, setErrorDescarga] = useState(null)

  useEffect(() => {
    let vigente = true
    setCargando(true)
    setError(null)
    obtenerLibroVentas(mes, anio)
      .then((data) => vigente && setLibro(data))
      .catch((err) => vigente && setError(err.message))
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [mes, anio])

  async function descargarExcel() {
    setDescargando(true)
    setErrorDescarga(null)
    try {
      const blob = await descargarLibroVentasExcel(mes, anio)
      const url = URL.createObjectURL(blob)
      const enlace = document.createElement('a')
      enlace.href = url
      enlace.download = `libro-ventas-${anio}-${String(mes).padStart(2, '0')}.xlsx`
      document.body.appendChild(enlace)
      enlace.click()
      enlace.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setErrorDescarga(err.message)
    } finally {
      setDescargando(false)
    }
  }

  const hayFilas = libro && libro.filas.length > 0

  return (
    <section>
      <h1>Libro de Ventas</h1>
      <p className="resumen-turno-actual">
        IVA del mes elegido: importe base y débito fiscal (13%) de cada factura emitida.
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
          <input
            type="number"
            min="2000"
            max="2100"
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value))}
          />
        </label>
        <button type="button" className="btn btn-azul" onClick={descargarExcel} disabled={descargando || !hayFilas}>
          {descargando ? 'Descargando...' : 'Descargar Libro de Ventas'}
        </button>
      </div>

      {errorDescarga && <p className="error">No se pudo descargar el Excel: {errorDescarga}</p>}

      {cargando && <p>Cargando...</p>}
      {!cargando && error && <p className="error">Error: {error}</p>}

      {!cargando && !error && !hayFilas && (
        <p className="orden-mensaje orden-mensaje-pendiente cajas-mensaje">No hay facturas en este mes.</p>
      )}

      {!cargando && !error && hayFilas && (
        <div className="reporte-tabla">
          <table className="tabla-facturas">
            <thead>
              <tr>
                <th>N°</th>
                <th>Fecha</th>
                <th>N° Factura</th>
                <th>NIT/CI</th>
                <th>Razón social</th>
                <th>Total (Bs.)</th>
                <th>Descuento (Bs.)</th>
                <th>Importe base (Bs.)</th>
                <th>Débito fiscal (Bs.)</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {libro.filas.map((f) => (
                <tr key={f.numero_factura} className={f.estado === 'A' ? 'fila-anulada' : ''}>
                  <td>{f.numero}</td>
                  <td>{new Date(f.fecha).toLocaleDateString()}</td>
                  <td>{f.numero_factura}</td>
                  <td>{f.nit_ci || '—'}</td>
                  <td>{f.razon_social}</td>
                  <td>{bs(f.total)}</td>
                  <td>{bs(f.descuento)}</td>
                  <td>{bs(f.importe_base)}</td>
                  <td>{bs(f.debito_fiscal)}</td>
                  <td>
                    <span className={`badge-estado ${f.estado === 'A' ? '' : 'badge-estado--emitida'}`}>
                      {ETIQUETA_ESTADO[f.estado] ?? f.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5}><strong>Totales del mes</strong></td>
                <td><strong>{bs(libro.totales.total)}</strong></td>
                <td><strong>{bs(libro.totales.descuento)}</strong></td>
                <td><strong>{bs(libro.totales.importe_base)}</strong></td>
                <td><strong>{bs(libro.totales.debito_fiscal)}</strong></td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  )
}

export default LibroVentas
