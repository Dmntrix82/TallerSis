import { createContext, useContext, useEffect, useState } from 'react'

const AdminAuthContext = createContext(null)
const STORAGE_KEY = 'tallersis_sesion_administrador'

// Sesion del administrador (vista de dashboards: tablero, documentos, egresos).
// Es independiente de la sesion del cajero -- un mismo navegador puede tener
// una sesion de cajero y una de administrador a la vez, en pestañas distintas.
export function AdminAuthProvider({ children }) {
  const [administrador, setAdministrador] = useState(() => {
    try {
      const guardado = sessionStorage.getItem(STORAGE_KEY)
      return guardado ? JSON.parse(guardado) : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    try {
      if (administrador) {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(administrador))
      } else {
        sessionStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      // sessionStorage no disponible (modo privado, etc.): la sesion no persiste al recargar.
    }
  }, [administrador])

  function iniciarSesion(datosAdministrador) {
    setAdministrador(datosAdministrador)
  }

  function cerrarSesion() {
    setAdministrador(null)
  }

  return (
    <AdminAuthContext.Provider value={{ administrador, iniciarSesion, cerrarSesion }}>
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth() {
  const contexto = useContext(AdminAuthContext)
  if (!contexto) {
    throw new Error('useAdminAuth debe usarse dentro de <AdminAuthProvider>')
  }
  return contexto
}
