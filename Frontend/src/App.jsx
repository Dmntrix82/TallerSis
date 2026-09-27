import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import Home from './pages/Home.jsx'
import Cajeros from './pages/Cajeros.jsx'
import Pagos from './pages/Pagos.jsx'
import ConsultaTransaccion from './pages/ConsultaTransaccion.jsx'
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
          <Route path="/consulta-transaccion" element={<ConsultaTransaccion />} />
        </Routes>
      </main>
    </>
  )
}

export default App
