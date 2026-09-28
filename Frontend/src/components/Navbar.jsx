import { NavLink } from 'react-router-dom'

function Navbar() {
  return (
    <nav className="navbar">
      <NavLink to="/">Inicio</NavLink>
      <NavLink to="/cajeros">Cajeros</NavLink>
      <NavLink to="/pagos">Pagos</NavLink>
      <NavLink to="/clientes">Clientes</NavLink>
      <NavLink to="/autorizacion-anulacion">Autorizar anulación</NavLink>
      <NavLink to="/apertura-turno">Apertura de turno</NavLink>
      <NavLink to="/credenciales">Credenciales</NavLink>
      <NavLink to="/consulta-transaccion">Consultar transacción</NavLink>
      <NavLink to="/ordenes-pago">Órdenes de pago</NavLink>
    </nav>
  )
}

export default Navbar