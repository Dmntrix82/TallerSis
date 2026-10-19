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
      <NavLink to="/admin/ventas-online">Ventas online</NavLink>
      <NavLink to="/admin/tablero">Tablero</NavLink>
      <NavLink to="/admin/cierre-diario">Cierre diario</NavLink>
      <NavLink to="/admin/monitoreo-cajeros">Monitoreo de cajeros</NavLink>
      <NavLink to="/admin/cajas">Cajas</NavLink>
      <NavLink to="/admin/reportes">Reportes</NavLink>
      <NavLink to="/admin/recaudado">Recaudado</NavLink>
      <NavLink to="/admin/comparacion">Comparación</NavLink>
      <NavLink to="/admin/diferencias">Diferencias</NavLink>
      <NavLink to="/admin/solicitudes-apertura">Solicitudes de apertura</NavLink>
      <NavLink to="/admin/solicitudes-cierre">Solicitudes de cierre</NavLink>
      <NavLink to="/admin/aprobaciones">Aprobaciones</NavLink>

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