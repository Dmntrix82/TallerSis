import { Routes, Route } from 'react-router-dom'
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
import './App.css'

function App() {
  return (
    <>
      <Navbar />
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
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
        </Routes>
      </main>
    </>
  )
}

export default App