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
      <NavLink to="/clientes">Clientes</NavLink>
    </nav>
  )
}

export default Navbar
