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
      <NavLink to="/admin/tablero">Tablero</NavLink>
      <NavLink to="/admin/documentos-factura">Documentos</NavLink>
      <NavLink to="/admin/egresos">Egresos</NavLink>
      <NavLink to="/admin/ordenes-proveedores">Órdenes a Prov.</NavLink>
      <NavLink to="/admin/anulaciones-online">Anulaciones</NavLink>

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
