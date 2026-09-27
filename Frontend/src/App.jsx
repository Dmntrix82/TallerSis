import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import Home from './pages/Home.jsx'
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
import Login from './pages/Login.jsx'
import './App.css'

function App() {
  const { pathname } = useLocation()
  const esPantallaLogin = pathname === '/login'

  return (
    <>
      {!esPantallaLogin && <Navbar />}
      <main className={esPantallaLogin ? undefined : 'container'}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/cajeros" element={<Cajeros />} />
          <Route path="/pagos" element={<Pagos />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/autorizacion-anulacion" element={<AutorizacionAnulacion />} />
          <Route path="/admin/ventas-online" element={<VentasOnline />} />
          <Route path="/apertura-turno" element={<AperturaTurno />} />
          <Route path="/credenciales" element={<GenerarToken />} />
          <Route path="/consulta-transaccion" element={<ConsultaTransaccion />} />
          <Route path="/ordenes-pago" element={<OrdenesPago />} />
          <Route path="/pago-mixto" element={<PagoMixtoForm />} />
          <Route path="/facturacion" element={<Facturacion />} />
        </Routes>
      </main>
    </>
  )
}

export default App