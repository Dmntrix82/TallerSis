import { useState } from 'react'
import { generarToken, verificarToken } from '../api/auth.js'

const ESTADO_INICIAL = { clientId: '', clientSecret: '' }

function GenerarToken() {
  const [credenciales, setCredenciales] = useState(ESTADO_INICIAL)
  const [generando, setGenerando] = useState(false)
  const [error, setError] = useState(null)
  const [token, setToken] = useState(null)
  const [copiado, setCopiado] = useState(false)
  const [estadoConexion, setEstadoConexion] = useState(null) // 'verificando' | 'activa' | 'inactiva'

  function actualizarCampo(campo, valor) {
    setCredenciales((prev) => ({ ...prev, [campo]: valor }))
  }

  async function generar(event) {
    event.preventDefault()

    if (!credenciales.clientId || !credenciales.clientSecret) {
      setError('Complete el client_id y el client_secret.')
      return
    }

    setGenerando(true)
    setError(null)
    setToken(null)
    setEstadoConexion(null)

    try {
      const respuesta = await generarToken(credenciales)
      setToken(respuesta.data)
      await comprobarConexion(respuesta.data.access_token)
    } catch (err) {
      setError(err.message)
    } finally {
      setGenerando(false)
    }
  }

  async function comprobarConexion(accessToken) {
    setEstadoConexion('verificando')
    try {
      await verificarToken(accessToken)
      setEstadoConexion('activa')
    } catch {
      setEstadoConexion('inactiva')
    }
  }

  async function copiarToken() {
    try {
      await navigator.clipboard.writeText(token.access_token)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      setCopiado(false)
    }
  }

  function generarOtro() {
    setCredenciales(ESTADO_INICIAL)
    setToken(null)
    setError(null)
    setEstadoConexion(null)
  }

  return (
    <section>
      <h1>Credenciales del Sistema Cliente</h1>

      {!token && (
        <form className="token-form" onSubmit={generar}>
          <label className="campo">
            Client ID
            <input
              type="text"
              value={credenciales.clientId}
              onChange={(e) => actualizarCampo('clientId', e.target.value)}
            />
          </label>

          <label className="campo">
            Client Secret
            <input
              type="password"
              value={credenciales.clientSecret}
              onChange={(e) => actualizarCampo('clientSecret', e.target.value)}
            />
          </label>

          {error && <p className="error">{error}</p>}

          <button type="submit" className="btn" disabled={generando}>
            {generando ? 'Generando...' : 'Generar token'}
          </button>
        </form>
      )}

      {token && (
        <div className="token-resultado">
          <h2>Token generado</h2>

          <label className="campo">
            Access token
            <div className="token-copia">
              <input type="text" readOnly value={token.access_token} />
              <button type="button" className="btn btn-secundario" onClick={copiarToken}>
                {copiado ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          </label>

          <ul>
            <li>Tipo: {token.token_type}</li>
            <li>Expira en: {token.expires_in} segundos</li>
            <li>Expira el: {new Date(token.expira_en).toLocaleString()}</li>
          </ul>

          <p className="token-estado">
            Estado de la conexión:{' '}
            {estadoConexion === 'verificando' && 'Comprobando...'}
            {estadoConexion === 'activa' && <span className="estado-activo">Activa</span>}
            {estadoConexion === 'inactiva' && <span className="estado-inactivo">Inactiva</span>}
          </p>

          <button type="button" className="btn" onClick={generarOtro}>
            Generar otro token
          </button>
        </div>
      )}
    </section>
  )
}

export default GenerarToken
