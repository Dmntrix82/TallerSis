import { NavLink } from 'react-router-dom'

function Navbar() {
  return (
    <nav className="navbar">
      <span className="navbar-brand">TallerSis</span>
      <NavLink to="/" end>
        Inicio
      </NavLink>
      <NavLink to="/cajeros">Cajeros</NavLink>
      <NavLink to="/pagos">Pagos</NavLink>
      <NavLink to="/cierre-caja" style={{ backgroundColor: '#dc2626', color: 'white', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>Cerrar Caja</NavLink>
    </nav>
  )
}

export default Navbar
