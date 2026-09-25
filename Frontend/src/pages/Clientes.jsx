import { useState } from 'react'
import ClienteBuscador from '../components/ClienteBuscador.jsx'

function Clientes() {
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null)

  return (
    <section>
      <h1>Buscar cliente</h1>
      <p>Busque un cliente frecuente por NIT para autocompletar sus datos.</p>

      <ClienteBuscador onClienteSeleccionado={setClienteSeleccionado} />

      {clienteSeleccionado && (
        <div className="cliente-resumen">
          <h2>Cliente seleccionado</h2>
          <ul>
            <li>NIT: {clienteSeleccionado.nit}</li>
            <li>Razón social: {clienteSeleccionado.razon_social}</li>
          </ul>
        </div>
      )}
    </section>
  )
}

export default Clientes
