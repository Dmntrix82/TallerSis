import { useEffect, useState } from 'react'
import { getCajerosStatus } from '../api/cajeros.js'

function Cajeros() {
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getCajerosStatus()
      .then(setStatus)
      .catch((err) => setError(err.message))
  }, [])

  return (
    <section>
      <h1>Cajeros</h1>
      {error && <p className="error">Error: {error}</p>}
      {!error && !status && <p>Cargando...</p>}
      {status && (
        <ul>
          <li>Mensaje: {status.mensaje}</li>
          <li>Estado: {status.estado}</li>
        </ul>
      )}
    </section>
  )
}

export default Cajeros
