import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import AdminNavbar from './components/AdminNavbar.jsx'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import Cajeros from './pages/Cajeros.jsx'
import Pagos from './pages/Pagos.jsx'
import Clientes from './pages/Clientes.jsx'
import AutorizacionAnulacion from './pages/AutorizacionAnulacion.jsx'
import VentasOnline from './pages/VentasOnline';
import AperturaTurno from './pages/AperturaTurno.jsx'
import GenerarToken from './pages/GenerarToken.jsx'
import ConsultaTransaccion from './pages/ConsultaTransaccion.jsx'
import OrdenesPago from './pages/OrdenesPago.jsx'
import PagoMixtoForm from './components/PagoMixtoForm';
import Facturacion from './pages/Facturacion.jsx'
import Facturas from './pages/Facturas.jsx'
import TableroIngresos from './pages/TableroIngresos.jsx'
import DocumentosFactura from './pages/DocumentosFactura.jsx'
import ResumenVentas from './pages/ResumenVentas.jsx'
import EgresoProveedor from './pages/EgresoProveedor.jsx'
import OrdenesProveedores from './pages/OrdenesProveedores.jsx'
import CierreCaja from './pages/CierreCaja.jsx'
import { useAuth } from './context/AuthContext.jsx'
import { useAdminAuth } from './context/AdminAuthContext.jsx'
import './App.css'

function RutaProtegida({ children }) {
  const { cajero } = useAuth()
  return cajero ? children : <Navigate to="/login" replace />
}

function RutaProtegidaAdmin({ children }) {
  const { administrador } = useAdminAuth()
  return administrador ? children : <Navigate to="/login" replace />
}

function App() {
  const { pathname } = useLocation()
  const esPantallaLogin = pathname === '/login'
  const esSeccionAdmin = pathname.startsWith('/admin')

  return (
    <>
      {!esPantallaLogin && (esSeccionAdmin ? <AdminNavbar /> : <Navbar />)}
      <main className={esPantallaLogin ? undefined : 'container'}>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Rutas del cajero */}
          <Route path="/" element={<RutaProtegida><Home /></RutaProtegida>} />
          <Route path="/cajeros" element={<RutaProtegida><Cajeros /></RutaProtegida>} />
          <Route path="/pagos" element={<RutaProtegida><Pagos /></RutaProtegida>} />
          <Route path="/clientes" element={<RutaProtegida><Clientes /></RutaProtegida>} />
          <Route path="/autorizacion-anulacion" element={<RutaProtegida><AutorizacionAnulacion /></RutaProtegida>} />
          <Route path="/apertura-turno" element={<RutaProtegida><AperturaTurno /></RutaProtegida>} />
          <Route path="/credenciales" element={<RutaProtegida><GenerarToken /></RutaProtegida>} />
          <Route path="/consulta-transaccion" element={<RutaProtegida><ConsultaTransaccion /></RutaProtegida>} />
          <Route path="/ordenes-pago" element={<RutaProtegida><OrdenesPago /></RutaProtegida>} />
          <Route path="/pago-mixto" element={<RutaProtegida><PagoMixtoForm /></RutaProtegida>} />
          <Route path="/facturacion" element={<RutaProtegida><Facturacion /></RutaProtegida>} />
          <Route path="/facturas" element={<RutaProtegida><Facturas /></RutaProtegida>} />
          <Route path="/resumen-ventas" element={<RutaProtegida><ResumenVentas /></RutaProtegida>} />
          <Route path="/cierre-caja" element={<RutaProtegida><CierreCaja /></RutaProtegida>} />

          {/* Panel de Administración */}
          <Route path="/admin/ventas-online" element={<RutaProtegidaAdmin><VentasOnline /></RutaProtegidaAdmin>} />
          <Route path="/admin/documentos-factura" element={<RutaProtegidaAdmin><DocumentosFactura /></RutaProtegidaAdmin>} />
          <Route path="/admin/tablero" element={<RutaProtegidaAdmin><TableroIngresos /></RutaProtegidaAdmin>} />
          <Route path="/admin/egresos" element={<RutaProtegidaAdmin><EgresoProveedor /></RutaProtegidaAdmin>} />
          <Route path="/admin/ordenes-proveedores" element={<RutaProtegidaAdmin><OrdenesProveedores /></RutaProtegidaAdmin>} />
        </Routes>
      </main>
    </>
  )
}

export default App
