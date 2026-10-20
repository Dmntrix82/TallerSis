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
import EstadoCajas from './pages/EstadoCajas.jsx'
import ReportesCaja from './pages/ReportesCaja.jsx'
import RecaudadoCajas from './pages/RecaudadoCajas.jsx'
import ComparacionMontos from './pages/ComparacionMontos.jsx'
import DiferenciasCaja from './pages/DiferenciasCaja.jsx'
import SolicitudesApertura from './pages/SolicitudesApertura.jsx'
import SolicitudesCierre from './pages/SolicitudesCierre.jsx'
import OperacionesAprobacion from './pages/OperacionesAprobacion.jsx'
import AnulacionesPendientes from './pages/AnulacionesPendientes.jsx'
import { useAuth } from './context/AuthContext.jsx'
import { useAdminAuth } from './context/AdminAuthContext.jsx'
import CierreDiario from './pages/CierreDiario.jsx'
import MonitoreoCajeros from './pages/MonitoreoCajeros'
import RevisionTransacciones from './pages/RevisionTransacciones'
import HistorialOperaciones from './pages/HistorialOperaciones'
import MetodosPago from './pages/MetodosPago.jsx'
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
          <Route path="/admin/cierre-diario" element={<RutaProtegidaAdmin><CierreDiario /></RutaProtegidaAdmin>} />
          <Route path="/admin/monitoreo-cajeros" element={<RutaProtegidaAdmin><MonitoreoCajeros /></RutaProtegidaAdmin>} />
          <Route path="/admin/cajas" element={<RutaProtegidaAdmin><EstadoCajas /></RutaProtegidaAdmin>} />
          <Route path="/admin/reportes" element={<RutaProtegidaAdmin><ReportesCaja /></RutaProtegidaAdmin>} />
          <Route path="/admin/recaudado" element={<RutaProtegidaAdmin><RecaudadoCajas /></RutaProtegidaAdmin>} />
          <Route path="/admin/comparacion" element={<RutaProtegidaAdmin><ComparacionMontos /></RutaProtegidaAdmin>} />
          <Route path="/admin/diferencias" element={<RutaProtegidaAdmin><DiferenciasCaja /></RutaProtegidaAdmin>} />
          <Route path="/admin/solicitudes-apertura" element={<RutaProtegidaAdmin><SolicitudesApertura /></RutaProtegidaAdmin>} />
          <Route path="/admin/solicitudes-cierre" element={<RutaProtegidaAdmin><SolicitudesCierre /></RutaProtegidaAdmin>} />
          <Route path="/admin/aprobaciones" element={<RutaProtegidaAdmin><OperacionesAprobacion /></RutaProtegidaAdmin>} />
          <Route path="/admin/revision-transacciones" element={<RutaProtegidaAdmin><RevisionTransacciones /></RutaProtegidaAdmin>} />
          <Route path="/admin/historial-operaciones" element={<RutaProtegidaAdmin><HistorialOperaciones /></RutaProtegidaAdmin>} />
          <Route path="/admin/metodos-pago" element={<RutaProtegidaAdmin><MetodosPago /></RutaProtegidaAdmin>} />
          <Route path="/admin/anulaciones-pendientes" element={<RutaProtegidaAdmin><AnulacionesPendientes /></RutaProtegidaAdmin>} />
        </Routes>
      </main>
    </>
  )
}

export default App