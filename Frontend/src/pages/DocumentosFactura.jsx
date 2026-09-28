import { useState } from 'react'
import { descargarDocumento, obtenerEstadoDocumentos } from '../api/documentos.js'

const TIPOS = ['PDF', 'XML']

const ETIQUETAS_ESTADO = {
  EnProceso: 'En proceso',
  Listo: 'Listo',
  Error: 'Error',
}

// TDSI-355: pantalla donde el administrador descarga el PDF/XML de una factura.
function DocumentosFactura() {
  const [numero, setNumero] = useState('')
  const [documentos, setDocumentos] = useState(null) // { PDF: {...}, XML: {...} }
  const [buscando, setBuscando] = useState(false)
  const [errorBusqueda, setErrorBusqueda] = useState(null)
  const [descargando, setDescargando] = useState(null) // 'pdf' | 'xml' | null
  const [errorDescarga, setErrorDescarga] = useState(null)

  async function buscar(event) {
    event.preventDefault()

    if (!numero.trim()) {
      setErrorBusqueda('Ingrese el número de factura.')
      return
    }

    setErrorBusqueda(null)
    setErrorDescarga(null)
    setDocumentos(null)
    setBuscando(true)

    try {
      const respuesta = await obtenerEstadoDocumentos(numero.trim())
      const porTipo = {}
      for (const doc of respuesta.data.documentos) porTipo[doc.tipo] = doc
      setDocumentos(porTipo)
    } catch (err) {
      setErrorBusqueda(err.message)
    } finally {
      setBuscando(false)
    }
  }

  async function descargar(tipo) {
    setErrorDescarga(null)
    setDescargando(tipo)
    try {
      await descargarDocumento(numero.trim(), tipo)
    } catch (err) {
      // TDSI-358: mensaje de error si el documento no se pudo descargar
      setErrorDescarga(err.message)
    } finally {
      setDescargando(null)
    }
  }

  return (
    <section>
      <h1>Documentos de factura</h1>

      <form className="documentos-form" onSubmit={buscar}>
        <label className="campo">
          Número de factura
          <input
            type="text"
            placeholder="Ej. F-000007"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
          />
        </label>

        <button type="submit" className="btn" disabled={buscando}>
          {buscando ? 'Buscando...' : 'Buscar'}
        </button>
      </form>

      {errorBusqueda && <p className="error">Error: {errorBusqueda}</p>}

      {documentos && (
        <div className="documentos-lista">
          {TIPOS.map((tipo) => {
            const doc = documentos[tipo]
            const estado = doc?.estado
            const listo = estado === 'Listo'

            return (
              <div key={tipo} className="documento-card">
                <span className="documento-tipo">{tipo}</span>
                {/* TDSI-356: estado de generación del documento */}
                <span className={`badge-estado${listo ? ' badge-estado--emitida' : ''}`}>
                  {doc ? ETIQUETAS_ESTADO[estado] ?? estado : 'No generado'}
                </span>
                {/* TDSI-357: botón de descarga */}
                <button
                  type="button"
                  className="btn btn-secundario"
                  disabled={!listo || descargando === tipo.toLowerCase()}
                  onClick={() => descargar(tipo.toLowerCase())}
                >
                  {descargando === tipo.toLowerCase() ? 'Descargando...' : `Descargar ${tipo}`}
                </button>
                {/* TDSI-358: mensaje de error si el documento no se pudo generar */}
                {estado === 'Error' && <p className="error">El {tipo} no se pudo generar.</p>}
              </div>
            )
          })}
        </div>
      )}

      {errorDescarga && <p className="error">Error: {errorDescarga}</p>}
    </section>
  )
}

export default DocumentosFactura
