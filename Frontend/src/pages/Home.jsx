import { useAuth } from '../context/AuthContext.jsx'
import TurnoModal from '../components/TurnoModal.jsx'

// TDSI-269: muestra el nombre del cajero autenticado en la pantalla principal.
function Home() {
  const { cajero } = useAuth()

  return (
    <section>
      <TurnoModal />
      <div className="terminal-header">
        <h1>Bienvenido, {cajero?.nombre}</h1>
        <p className="terminal-header-caja">
          Terminal {cajero?.caja}
          {cajero?.cajaNombre ? ` · ${cajero.cajaNombre}` : ''}
        </p>
      </div>
      <p>Panel principal del sistema. Elegí un módulo en el menú para empezar.</p>
    </section>
  )
}

export default Home
