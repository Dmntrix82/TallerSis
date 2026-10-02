import { NavLink, useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../context/AdminAuthContext.jsx'

function AdminNavbar() {
  const { administrador, cerrarSesion } = useAdminAuth()
  const navigate = useNavigate()

  function handleCerrarSesion() {
    cerrarSesion()
    navigate('/login')
  }

  return (
    <nav className="navbar">
      <span className="navbar-brand">TallerSis · Administración</span>
      <NavLink to="/admin/cajeros">Cajeros</NavLink>
      <NavLink to="/admin/clientes">Clientes</NavLink>
      <NavLink to="/admin/tablero">Tablero</NavLink>

      <div className="navbar-sesion">
        <span className="navbar-cajero">{administrador?.nombre}</span>
        <button type="button" className="btn btn-logout" onClick={handleCerrarSesion}>
          Cerrar sesión
        </button>
      </div>
    </nav>
  )
}

export default AdminNavbar
