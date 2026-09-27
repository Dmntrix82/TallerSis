import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginCajero } from '../api/auth.js'
import { loginAdministrador } from '../api/authAdministrador.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useAdminAuth } from '../context/AdminAuthContext.jsx'

const ESTADO_INICIAL = {
  email: '',
  password: '',
  caja_id: '',
}

function validarCampos({ email, password, caja_id }, modo) {
  if (!email || !password || (modo === 'CAJERO' && !caja_id)) {
    return modo === 'CAJERO'
      ? 'Complete el usuario, la contraseña y la caja.'
      : 'Complete el usuario y la contraseña.'
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Ingrese un correo válido.'
  }
  if (password.length < 4) {
    return 'La contraseña debe tener al menos 4 caracteres.'
  }
  return null
}

// Alterna entre "entrar como Cajero" o "entrar como Administrador" en la misma pantalla.
function SelectorModo({ modo, onCambiar }) {
  const esAdmin = modo === 'ADMINISTRADOR'

  return (
    <button
      type="button"
      className={`selector-modo${esAdmin ? ' selector-modo--admin' : ''}`}
      onClick={() => onCambiar(esAdmin ? 'CAJERO' : 'ADMINISTRADOR')}
      aria-pressed={esAdmin}
    >
      <span className={`selector-modo-opcion${!esAdmin ? ' activo' : ''}`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7" />
        </svg>
        Cajero
      </span>
      <span className={`selector-modo-opcion${esAdmin ? ' activo' : ''}`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3l7 3v5c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6l7-3z" />
        </svg>
        Administrador
      </span>
      <span className="selector-modo-thumb" />
    </button>
  )
}

// TDSI-84: pantalla de inicio de sesión, tanto para el terminal POS (cajero) como para el panel de administración.
function Login() {
  const [modo, setModo] = useState('CAJERO') // 'CAJERO' | 'ADMINISTRADOR'
  const [datos, setDatos] = useState(ESTADO_INICIAL)
  const [errorValidacion, setErrorValidacion] = useState(null)
  const [errorApi, setErrorApi] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const { iniciarSesion: iniciarSesionCajero } = useAuth()
  const { iniciarSesion: iniciarSesionAdmin } = useAdminAuth()
  const navigate = useNavigate()

  function cambiarModo(nuevoModo) {
    setModo(nuevoModo)
    setErrorValidacion(null)
    setErrorApi(null)
  }

  function actualizarCampo(campo, valor) {
    setDatos((prev) => ({ ...prev, [campo]: valor }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const mensajeValidacion = validarCampos(datos, modo)
    if (mensajeValidacion) {
      setErrorValidacion(mensajeValidacion)
      setErrorApi(null)
      return
    }
    setErrorValidacion(null)
    setErrorApi(null)
    setEnviando(true)

    try {
      if (modo === 'CAJERO') {
        const respuesta = await loginCajero(datos)
        iniciarSesionCajero({
          nombre: respuesta.data.cajero.email,
          caja: respuesta.data.caja.codigo,
          cajaNombre: respuesta.data.caja.nombre,
        })
        navigate('/')
      } else {
        const respuesta = await loginAdministrador(datos)
        iniciarSesionAdmin(respuesta.data.administrador)
        navigate('/admin/tablero')
      }
    } catch (err) {
      setErrorApi(err.message)
    } finally {
      setEnviando(false)
    }
  }

  const esAdmin = modo === 'ADMINISTRADOR'

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
          {esAdmin ? (
            <>
              <h1>
                Panel de
                <br />
                Administración
              </h1>
              <p>Tablero de ingresos, documentos de factura y egresos a proveedores.</p>
            </>
          ) : (
            <>
              <h1>
                Hola
                <br />
                TallerSis!
              </h1>
              <p>Inicia sesión para habilitar la caja y empezar a atender en el terminal POS.</p>
            </>
          )}
        </div>
        <p className="login-hero-footer">© 2026 TallerSis. Todos los derechos reservados.</p>
      </aside>

      <div className="login-panel">
        <div className="login-panel-inner">
          <span className="login-brand">TallerSis</span>

          <SelectorModo modo={modo} onCambiar={cambiarModo} />

          <form className="login-form" onSubmit={handleSubmit}>
            <h2 className="login-titulo">{esAdmin ? 'Acceso de administrador' : 'Bienvenido de nuevo'}</h2>
            <p className="login-subtitulo">
              {esAdmin ? 'Ingresa tus credenciales para continuar.' : 'Ingresa tus credenciales de cajero para continuar.'}
            </p>

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

            {!esAdmin && (
              <label className="campo">
                Caja / terminal
                <input
                  type="text"
                  placeholder="Ej. CAJA-01"
                  value={datos.caja_id}
                  onChange={(e) => actualizarCampo('caja_id', e.target.value)}
                />
              </label>
            )}

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