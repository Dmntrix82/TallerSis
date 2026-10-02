import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

// "Cerrar sesión" y "Cerrar caja" son 2 acciones distintas: cerrar sesión solo
// vuelve al login (el turno sigue activo, se puede volver a entrar); cerrar caja
// termina el turno con un reporte de lo recaudado. Van juntas en un solo menú
// desplegable para que no se confundan con un link de navegación más.
function Navbar() {
  const { cajero, cerrarSesion } = useAuth()
  const navigate = useNavigate()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    function alHacerClicFuera(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuAbierto(false)
      }
    }
    document.addEventListener('mousedown', alHacerClicFuera)
    return () => document.removeEventListener('mousedown', alHacerClicFuera)
  }, [])

  function handleCerrarSesion() {
    setMenuAbierto(false)
    cerrarSesion()
    navigate('/login')
  }

  function handleCerrarCaja() {
    setMenuAbierto(false)
    navigate('/cierre-caja')
  }

  return (
    <nav className="navbar">
      <span className="navbar-brand">TallerSis</span>
      {cajero && (
        <>
          <NavLink to="/" end>Inicio</NavLink>
          <NavLink to="/pagos">Pagos</NavLink>
          <NavLink to="/facturas">Facturas</NavLink>
        </>
      )}

      <div className="navbar-sesion">
        {cajero ? (
          <div className="navbar-menu" ref={menuRef}>
            <button type="button" className="navbar-menu-boton" onClick={() => setMenuAbierto((v) => !v)}>
              {cajero.nombre}
              <span className="navbar-menu-flecha">▾</span>
            </button>

            {menuAbierto && (
              <div className="navbar-menu-lista">
                <button type="button" className="navbar-menu-opcion" onClick={handleCerrarCaja}>
                  Cerrar caja
                </button>
                <button type="button" className="navbar-menu-opcion navbar-menu-opcion--peligro" onClick={handleCerrarSesion}>
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        ) : (
          <span className="navbar-cajero navbar-cajero--vacio">Sin sesión iniciada</span>
        )}
      </div>
    </nav>
  )
}

export default Navbar
