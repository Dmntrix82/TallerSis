import { createContext, useContext, useEffect, useState } from 'react'

const AuthContext = createContext(null)
const STORAGE_KEY = 'tallersis_sesion_cajero'

// Sesion del cajero autenticado en el terminal POS.
// Se guarda en sessionStorage (no localStorage): al cerrar el navegador del
// terminal, la sesion se pierde, igual que un cierre de caja fisico.
export function AuthProvider({ children }) {
  const [cajero, setCajero] = useState(() => {
    try {
      const guardado = sessionStorage.getItem(STORAGE_KEY)
      return guardado ? JSON.parse(guardado) : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    try {
      if (cajero) {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cajero))
      } else {
        sessionStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      // sessionStorage no disponible (modo privado, etc.): la sesion no persiste al recargar.
    }
  }, [cajero])

  function iniciarSesion(datosCajero) {
    setCajero(datosCajero)
  }

  function cerrarSesion() {
    setCajero(null)
  }

  return (
    <AuthContext.Provider value={{ cajero, iniciarSesion, cerrarSesion }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const contexto = useContext(AuthContext)
  if (!contexto) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  }
  return contexto
}
