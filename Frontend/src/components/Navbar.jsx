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
      <NavLink to="/consulta-transaccion">Consultar transacción</NavLink>
    </nav>
  )
}

export default Navbar
