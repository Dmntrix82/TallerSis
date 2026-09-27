import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import Home from './pages/Home.jsx'
import Cajeros from './pages/Cajeros.jsx'
import Pagos from './pages/Pagos.jsx'
import VentasOnline from './pages/VentasOnline';

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
          <Route path="/admin/ventas-online" element={<VentasOnline />} />
        </Routes>
      </main>
    </>
  )
}

export default App
