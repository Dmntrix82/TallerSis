import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

// Grupo desplegable del menu del Administrador: junta varias pantallas relacionadas
// bajo un solo boton (mismo patron visual que el menu de sesion de Navbar.jsx), para
// no saturar la barra con mas de una decena de enlaces sueltos.
function AdminNavDropdown({ etiqueta, items }) {
  const [abierto, setAbierto] = useState(false)
  const location = useLocation()
  const ref = useRef(null)

  const activo = items.some((item) => location.pathname.startsWith(item.to))

  useEffect(() => {
    function alHacerClicFuera(e) {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false)
    }
    document.addEventListener('mousedown', alHacerClicFuera)
    return () => document.removeEventListener('mousedown', alHacerClicFuera)
  }, [])

  useEffect(() => {
    setAbierto(false)
  }, [location.pathname])

  return (
    <div className="navbar-menu" ref={ref}>
      <button
        type="button"
        className={`navbar-menu-boton navbar-menu-boton--nav${activo ? ' navbar-menu-boton--activo' : ''}`}
        onClick={() => setAbierto((v) => !v)}
      >
        {etiqueta}
        <span className="navbar-menu-flecha">▾</span>
      </button>

      {abierto && (
        <div className="navbar-menu-lista">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} className="navbar-menu-opcion">
              {item.etiqueta}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

export default AdminNavDropdown
