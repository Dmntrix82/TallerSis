import { NavLink, useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../context/AdminAuthContext.jsx'
import AdminNavDropdown from './AdminNavDropdown.jsx'

// TDSI-62 y otras pantallas fueron sumando enlaces sueltos hasta 14: se agrupan aqui
// en 6 botones (3 directos + 3 desplegables) sin sacar ninguna pantalla del menu.
const GESTION_ROLES_Y_CLIENTES = [
  { to: '/admin/cajeros', etiqueta: 'Cajeros' },
  { to: '/admin/supervisores', etiqueta: 'Supervisores' },
  { to: '/admin/usuarios', etiqueta: 'Usuarios' },
  { to: '/admin/clientes', etiqueta: 'Clientes' },
]

const REPORTES = [
  { to: '/admin/comparativo-mensual', etiqueta: 'Comparativo mensual' },
  { to: '/admin/horas-pico', etiqueta: 'Horas pico' },
  { to: '/admin/metas-venta', etiqueta: 'Metas de venta' },
  { to: '/admin/libro-ventas', etiqueta: 'Libro de Ventas' },
]

// Las 3 integraciones por Pub/Sub con los otros grupos del proyecto (Marketplace,
// Compras, Contabilidad), cada una identificada por el sistema externo al que llama.
const INTEGRACIONES = [
  { to: '/admin/ventas-online', etiqueta: 'Ventas online (Marketplace)' },
  { to: '/admin/productos-vendidos', etiqueta: 'Productos vendidos (Compras)' },
  { to: '/admin/diferencias', etiqueta: 'Diferencias de caja (Contabilidad)' },
]

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
      <NavLink to="/admin/cierre-diario">Cierre diario</NavLink>
      <NavLink to="/admin/historial-operaciones">Historial de operaciones</NavLink>
      <AdminNavDropdown etiqueta="Gestión de roles y clientes" items={GESTION_ROLES_Y_CLIENTES} />
      <AdminNavDropdown etiqueta="Reportes" items={REPORTES} />
      <AdminNavDropdown etiqueta="Integraciones" items={INTEGRACIONES} />

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
