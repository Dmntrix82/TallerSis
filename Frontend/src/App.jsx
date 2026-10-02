import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import AdminNavbar from './components/AdminNavbar.jsx'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import Cajeros from './pages/Cajeros.jsx'
import Pagos from './pages/Pagos.jsx'
import Clientes from './pages/Clientes.jsx'
import VentasOnline from './pages/VentasOnline';
import Facturas from './pages/Facturas.jsx'
import TableroIngresos from './pages/TableroIngresos.jsx'
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
          <Route path="/pagos" element={<RutaProtegida><Pagos /></RutaProtegida>} />
          <Route path="/facturas" element={<RutaProtegida><Facturas /></RutaProtegida>} />
          <Route path="/cierre-caja" element={<RutaProtegida><CierreCaja /></RutaProtegida>} />

          {/* Panel de Administración */}
          <Route path="/admin/cajeros" element={<RutaProtegidaAdmin><Cajeros /></RutaProtegidaAdmin>} />
          <Route path="/admin/clientes" element={<RutaProtegidaAdmin><Clientes /></RutaProtegidaAdmin>} />
          <Route path="/admin/ventas-online" element={<RutaProtegidaAdmin><VentasOnline /></RutaProtegidaAdmin>} />
          <Route path="/admin/tablero" element={<RutaProtegidaAdmin><TableroIngresos /></RutaProtegidaAdmin>} />
        </Routes>
      </main>
    </>
  )
}

export default App
