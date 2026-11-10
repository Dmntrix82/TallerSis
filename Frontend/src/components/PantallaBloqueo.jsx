import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { desbloquearPantalla } from '../api/auth.js'
import CampoPassword from './CampoPassword.jsx'
import './PantallaBloqueo.css'

const MAXIMO_INTENTOS = 3

// 404: no hay sesión activa para este cajero (p.ej. la cerró otra pestaña).
// 401 + este mensaje: ya se había cerrado por demasiados intentos fallidos.
const SESION_TERMINADA = /sesi[oó]n cerrada|inicie sesi[oó]n|no hay sesi[oó]n activa/i

// TDSI-856: pantalla de bloqueo con el nombre del cajero y su caja.
// TDSI-858: mensajes de contraseña incorrecta y cierre de sesión al tercer intento fallido.
function PantallaBloqueo({ intentos, onIntentoFallido, onDesbloqueada }) {
  const { cajero, cerrarSesion } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  function terminarSesion(mensaje) {
    cerrarSesion()
    navigate('/login', { replace: true, state: { mensaje } })
  }

  async function desbloquear(event) {
    event.preventDefault()
    if (!password) {
      setError('Escriba su contraseña.')
      return
    }

    setEnviando(true)
    setError(null)
    try {
      await desbloquearPantalla({ cajero_id: cajero.cajero_id, email: cajero.nombre, password })
      onDesbloqueada()
    } catch (err) {
      setPassword('')
      setEnviando(false)
      // Sin conexion no se cuenta como intento: no se llego a revisar la contraseña.
      if (err instanceof TypeError) {
        setError('No se pudo conectar con el servidor. Intente de nuevo.')
        return
      }
      if (err.status === 404 || SESION_TERMINADA.test(err.message)) {
        terminarSesion('Demasiados intentos fallidos. Inicie sesión nuevamente.')
        return
      }
      const fallidos = intentos + 1
      if (fallidos >= MAXIMO_INTENTOS) {
        terminarSesion('Demasiados intentos fallidos. Inicie sesión nuevamente.')
        return
      }
      onIntentoFallido(fallidos)
      const restantes = MAXIMO_INTENTOS - fallidos
      setError(`${err.message} ${restantes === 1 ? 'Le queda 1 intento.' : `Le quedan ${restantes} intentos.`}`)
    }
  }

  return (
    <div className="pantalla-bloqueo" role="dialog" aria-modal="true" aria-labelledby="titulo-bloqueo">
      <form className="pantalla-bloqueo-caja" onSubmit={desbloquear}>
        <svg className="pantalla-bloqueo-icono" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
        <h2 id="titulo-bloqueo">Pantalla bloqueada</h2>
        <p className="pantalla-bloqueo-cajero">{cajero.nombre}</p>
        <p className="pantalla-bloqueo-caja-nombre">
          {cajero.cajaNombre ? `${cajero.caja} · ${cajero.cajaNombre}` : cajero.caja}
        </p>
        <p className="pantalla-bloqueo-ayuda">El turno sigue abierto. Escriba su contraseña para volver.</p>

        <label className="campo">
          Contraseña
          <CampoPassword
            autoComplete="new-password"
            autoFocus
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setError(null)
            }}
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" className="btn" disabled={enviando}>
          {enviando ? 'Verificando...' : 'Desbloquear'}
        </button>
      </form>
    </div>
  )
}

export default PantallaBloqueo
