import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import Home from './pages/Home.jsx'
import Cajeros from './pages/Cajeros.jsx'
import './App.css'

function App() {
  return (
    <>
      <Navbar />
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/cajeros" element={<Cajeros />} />
        </Routes>
      </main>
    </>
  )
}

export default App
