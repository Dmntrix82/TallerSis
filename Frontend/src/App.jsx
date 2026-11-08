import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import AdminNavbar from './components/AdminNavbar.jsx'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import Cajeros from './pages/Cajeros.jsx'
import Pagos from './pages/Pagos.jsx'
import Clientes from './pages/Clientes.jsx'
import Facturas from './pages/Facturas.jsx'
import TableroIngresos from './pages/TableroIngresos.jsx'
import CierreCaja from './pages/CierreCaja.jsx'
import VerificarFactura from './pages/VerificarFactura.jsx'
import { useAuth } from './context/AuthContext.jsx'
import { useAdminAuth } from './context/AdminAuthContext.jsx'
import CierreDiario from './pages/CierreDiario.jsx'
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
  // TDSI-38: pagina publica (sin login) a la que lleva el QR de la factura.
  const esPaginaPublica = pathname.startsWith('/facturas/verificar/')

  return (
    <>
      {!esPantallaLogin && !esPaginaPublica && (esSeccionAdmin ? <AdminNavbar /> : <Navbar />)}
      <main className={esPantallaLogin || esPaginaPublica ? undefined : 'container'}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/facturas/verificar/:token" element={<VerificarFactura />} />

          {/* Rutas del cajero */}
          <Route path="/" element={<RutaProtegida><Home /></RutaProtegida>} />
          <Route path="/pagos" element={<RutaProtegida><Pagos /></RutaProtegida>} />
          <Route path="/facturas" element={<RutaProtegida><Facturas /></RutaProtegida>} />
          <Route path="/cierre-caja" element={<RutaProtegida><CierreCaja /></RutaProtegida>} />

          {/* Panel de Administración */}
          <Route path="/admin/cajeros" element={<RutaProtegidaAdmin><Cajeros /></RutaProtegidaAdmin>} />
          <Route path="/admin/clientes" element={<RutaProtegidaAdmin><Clientes /></RutaProtegidaAdmin>} />
          <Route path="/admin/tablero" element={<RutaProtegidaAdmin><TableroIngresos /></RutaProtegidaAdmin>} />
          <Route path="/admin/cierre-diario" element={<RutaProtegidaAdmin><CierreDiario /></RutaProtegidaAdmin>} />
        </Routes>
      </main>
    </>
  )
}

export default App
