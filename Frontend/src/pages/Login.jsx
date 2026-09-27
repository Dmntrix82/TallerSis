import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginCajero } from '../api/auth.js'
import { useAuth } from '../context/AuthContext.jsx'

const ESTADO_INICIAL = {
  email: '',
  password: '',
  caja_id: '',
}

// TDSI-261: validaciones de formato antes de golpear el backend.
function validarCampos({ email, password, caja_id }) {
  if (!email || !password || !caja_id) {
    return 'Complete el usuario, la contraseña y la caja.'
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Ingrese un correo válido.'
  }
  if (password.length < 4) {
    return 'La contraseña debe tener al menos 4 caracteres.'
  }
  return null
}

// TDSI-84: pantalla de inicio de sesión del terminal POS.
function Login() {
  const [datos, setDatos] = useState(ESTADO_INICIAL)
  const [errorValidacion, setErrorValidacion] = useState(null)
  const [errorApi, setErrorApi] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const { iniciarSesion } = useAuth()
  const navigate = useNavigate()

  function actualizarCampo(campo, valor) {
    setDatos((prev) => ({ ...prev, [campo]: valor }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const mensajeValidacion = validarCampos(datos)
    if (mensajeValidacion) {
      setErrorValidacion(mensajeValidacion)
      setErrorApi(null)
      return
    }
    setErrorValidacion(null)
    setErrorApi(null)
    setEnviando(true)

    try {
      const respuesta = await loginCajero(datos)
      iniciarSesion({
        nombre: respuesta.data.cajero.email,
        caja: respuesta.data.caja.codigo,
        cajaNombre: respuesta.data.caja.nombre,
      })
      navigate('/')
    } catch (err) {
      setErrorApi(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="login-page">
      <aside className="login-hero">
        <div className="login-hero-content">
          <svg
            className="login-hero-logo"
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <line x1="12" y1="2" x2="12" y2="22" />
            <line x1="4" y1="7" x2="20" y2="17" />
            <line x1="20" y1="7" x2="4" y2="17" />
          </svg>
          <h1>
            Hola
            <br />
            TallerSis!
          </h1>
          <p>Inicia sesión para habilitar la caja y empezar a atender en el terminal POS.</p>
        </div>
        <p className="login-hero-footer">© 2026 TallerSis. Todos los derechos reservados.</p>
      </aside>

      <div className="login-panel">
        <div className="login-panel-inner">
          <span className="login-brand">TallerSis</span>

          <form className="login-form" onSubmit={handleSubmit}>
            <h2 className="login-titulo">Bienvenido de nuevo</h2>
            <p className="login-subtitulo">Ingresa tus credenciales de cajero para continuar.</p>

            <label className="campo">
              Usuario (correo)
              <input
                type="email"
                autoComplete="username"
                value={datos.email}
                onChange={(e) => actualizarCampo('email', e.target.value)}
              />
            </label>

            <label className="campo">
              Contraseña
              <input
                type="password"
                autoComplete="current-password"
                value={datos.password}
                onChange={(e) => actualizarCampo('password', e.target.value)}
              />
            </label>

            <label className="campo">
              Caja / terminal
              <input
                type="text"
                placeholder="Ej. CAJA-01"
                value={datos.caja_id}
                onChange={(e) => actualizarCampo('caja_id', e.target.value)}
              />
            </label>

            {errorValidacion && <p className="error">{errorValidacion}</p>}
            {errorApi && <p className="error">Error: {errorApi}</p>}

            <button type="submit" className="btn login-btn" disabled={enviando}>
              {enviando ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Login