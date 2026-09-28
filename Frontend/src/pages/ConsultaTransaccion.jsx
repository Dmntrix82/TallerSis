import { useState } from 'react'
import { consultarEstadoTransaccion } from '../api/transacciones.js'

const COLOR_POR_ESTADO = {
  APROBADA: 'estado-verde',
  PENDIENTE: 'estado-amarillo',
  RECHAZADA: 'estado-rojo',
}

function ConsultaTransaccion() {
  const [accessToken, setAccessToken] = useState('')
  const [codigo, setCodigo] = useState('')
  const [consultando, setConsultando] = useState(false)
  const [error, setError] = useState(null)
  const [resultado, setResultado] = useState(null)

  async function consultar(event) {
    event.preventDefault()

    if (!accessToken || !codigo) {
      setError('Ingrese el token de acceso y el código de la transacción.')
      return
    }

    setConsultando(true)
    setError(null)
    setResultado(null)

    try {
      const respuesta = await consultarEstadoTransaccion(codigo.trim(), accessToken.trim())
      setResultado(respuesta.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setConsultando(false)
    }
  }

  function nuevaConsulta() {
    setCodigo('')
    setResultado(null)
    setError(null)
  }

  return (
    <section>
      <h1>Consultar estado de transacción</h1>

      <form className="consulta-form" onSubmit={consultar}>
        <label className="campo">
          Token de acceso
          <input
            type="text"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="Generado en la pantalla de Credenciales"
          />
        </label>

        <label className="campo">
          Código de transacción
          <input
            type="text"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Ej. TXN-000101"
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" className="btn" disabled={consultando}>
          {consultando ? 'Consultando...' : 'Consultar'}
        </button>
      </form>

      {resultado && (
        <div className="consulta-resultado">
          <h2>Transacción {resultado.id_transaccion}</h2>
          <p>
            Estado:{' '}
            <span className={`estado-badge ${COLOR_POR_ESTADO[resultado.estado_pago] ?? ''}`}>
              {resultado.estado_pago}
            </span>
          </p>
          <p>Último cambio: {new Date(resultado.actualizado_en).toLocaleString()}</p>
          <button type="button" className="btn btn-secundario" onClick={nuevaConsulta}>
            Nueva consulta
          </button>
        </div>
      )}
    </section>
  )
}

export default ConsultaTransaccion
