import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext.jsx'
import PantallaBloqueo from '../components/PantallaBloqueo.jsx'

// TDSI-53: bloqueo de la pantalla del cajero.
const MINUTOS_SIN_USO = 5
const EVENTOS_DE_USO = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel', 'scroll']
// Se guarda en sessionStorage para que recargar la página no sirva para saltarse el bloqueo.
const STORAGE_KEY = 'tallersis_pantalla_bloqueada'

const BloqueoContext = createContext(null)

function leerBloqueo() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) // { intentos } | null
  } catch {
    return null
  }
}

function guardarBloqueo(valor) {
  try {
    if (valor) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(valor))
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // sessionStorage no disponible: el bloqueo no sobrevive a una recarga.
  }
}

// Solo aplica a las pantallas del cajero con sesión iniciada.
function esPantallaDelCajero(pathname) {
  return pathname !== '/login' && !pathname.startsWith('/admin') && !pathname.startsWith('/facturas/verificar/')
}

export function BloqueoProvider({ children }) {
  const { cajero } = useAuth()
  const { pathname } = useLocation()
  const [bloqueo, setBloqueo] = useState(leerBloqueo)
  const contenidoRef = useRef(null)

  const activo = Boolean(cajero) && esPantallaDelCajero(pathname)
  const bloqueada = activo && bloqueo !== null

  const actualizarBloqueo = useCallback((valor) => {
    guardarBloqueo(valor)
    setBloqueo(valor)
  }, [])

  // TDSI-855: "Bloquear pantalla" a mano. El turno sigue abierto: solo se tapa la pantalla.
  const bloquear = useCallback(() => {
    setBloqueo((actual) => {
      const valor = actual ?? { intentos: 0 }
      guardarBloqueo(valor)
      return valor
    })
  }, [])

  // Al cerrar sesión (o si no hay cajero) no queda un bloqueo pendiente.
  useEffect(() => {
    if (!cajero && bloqueo !== null) actualizarBloqueo(null)
  }, [cajero, bloqueo, actualizarBloqueo])

  // TDSI-184: 5 minutos sin teclado, mouse ni pantalla táctil bloquean la terminal.
  useEffect(() => {
    if (!activo || bloqueada) return
    let temporizador
    function reiniciar() {
      clearTimeout(temporizador)
      temporizador = setTimeout(bloquear, MINUTOS_SIN_USO * 60 * 1000)
    }
    reiniciar()
    EVENTOS_DE_USO.forEach((e) => window.addEventListener(e, reiniciar, { passive: true, capture: true }))
    return () => {
      clearTimeout(temporizador)
      EVENTOS_DE_USO.forEach((e) => window.removeEventListener(e, reiniciar, { capture: true }))
    }
  }, [activo, bloqueada, bloquear])

  // TDSI-857: la pantalla de abajo no se desmonta (lo cargado en Pagos se mantiene), pero
  // mientras está bloqueada no se puede usar: ni con el mouse ni llegando con Tab.
  useEffect(() => {
    const contenido = contenidoRef.current
    if (!contenido) return
    if (bloqueada) {
      contenido.setAttribute('inert', '')
      contenido.setAttribute('aria-hidden', 'true')
    } else {
      contenido.removeAttribute('inert')
      contenido.removeAttribute('aria-hidden')
    }
  }, [bloqueada])

  return (
    <BloqueoContext.Provider value={{ bloquear, bloqueada }}>
      <div ref={contenidoRef} style={{ display: 'contents' }}>
        {children}
      </div>
      {bloqueada && (
        <PantallaBloqueo
          intentos={bloqueo.intentos}
          onIntentoFallido={(intentos) => actualizarBloqueo({ intentos })}
          onDesbloqueada={() => actualizarBloqueo(null)}
        />
      )}
    </BloqueoContext.Provider>
  )
}

export function useBloqueo() {
  const contexto = useContext(BloqueoContext)
  if (!contexto) {
    throw new Error('useBloqueo debe usarse dentro de <BloqueoProvider>')
  }
  return contexto
}
