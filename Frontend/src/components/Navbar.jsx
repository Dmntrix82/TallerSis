import { NavLink } from 'react-router-dom'

function Navbar() {
  return (
    <nav className="navbar">
      <NavLink to="/">Inicio</NavLink>
      <NavLink to="/cajeros">Cajeros</NavLink>
      <NavLink to="/pagos">Pagos</NavLink>
      <NavLink to="/clientes">Clientes</NavLink>
      <NavLink to="/autorizacion-anulacion">Autorizar anulación</NavLink>
    </nav>
  )
}

export default Navbar