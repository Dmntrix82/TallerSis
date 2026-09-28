import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

function Navbar() {
  const { cajero, cerrarSesion } = useAuth()
  const navigate = useNavigate()

  function handleCerrarSesion() {
    cerrarSesion()
    navigate('/login')
  }

  return (
    <nav className="navbar">
      <span className="navbar-brand">TallerSis</span>
      {cajero && (
        <>
          <NavLink to="/" end>Inicio</NavLink>
          <NavLink to="/cajeros">Cajeros</NavLink>
          <NavLink to="/pagos">Pagos</NavLink>
          <NavLink to="/clientes">Clientes</NavLink>
          <NavLink to="/autorizacion-anulacion">Autorizar anulación</NavLink>
          <NavLink to="/apertura-turno">Apertura de turno</NavLink>
          <NavLink to="/credenciales">Credenciales</NavLink>
          <NavLink to="/consulta-transaccion">Consultar transacción</NavLink>
          <NavLink to="/ordenes-pago">Órdenes de pago</NavLink>
          <NavLink to="/facturacion">Facturación</NavLink>
          <NavLink to="/facturas">Facturas</NavLink>
          <NavLink to="/tablero">Tablero</NavLink>
          <NavLink to="/documentos-factura">Documentos</NavLink>
          <NavLink to="/resumen-ventas">Resumen de ventas</NavLink>
        </>
      )}

      <div className="navbar-sesion">
        {cajero ? (
          <>
            <span className="navbar-cajero">{cajero.nombre}</span>
            <button type="button" className="btn btn-logout" onClick={handleCerrarSesion}>
              Cerrar sesión
            </button>
          </>
        ) : (
          <span className="navbar-cajero navbar-cajero--vacio">Sin sesión iniciada</span>
        )}
      </div>
    </nav>
  )
}

export default Navbar