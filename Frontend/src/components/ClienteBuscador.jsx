import { useEffect, useRef, useState } from 'react'
import { sugerirClientes } from '../api/clientes.js'

const DEBOUNCE_MS = 300
const LIMITE_SUGERENCIAS = 8

function ClienteBuscador({ onClienteSeleccionado }) {
  const [nit, setNit] = useState('')
  const [razonSocial, setRazonSocial] = useState('')
  const [sugerencias, setSugerencias] = useState([])
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const [sinResultados, setSinResultados] = useState(false)
  const timeoutRef = useRef(null)

  useEffect(() => {
    clearTimeout(timeoutRef.current)

    const query = nit.trim()
    if (!query) {
      setSugerencias([])
      setSinResultados(false)
      setMostrarSugerencias(false)
      return
    }

    timeoutRef.current = setTimeout(async () => {
      setBuscando(true)
      try {
        const resultados = await sugerirClientes(query, LIMITE_SUGERENCIAS)
        setSugerencias(resultados)
        setSinResultados(resultados.length === 0)
        setMostrarSugerencias(true)
      } catch {
        setSugerencias([])
        setSinResultados(false)
        setMostrarSugerencias(false)
      } finally {
        setBuscando(false)
      }
    }, DEBOUNCE_MS)

    return () => clearTimeout(timeoutRef.current)
  }, [nit])

  function actualizarNit(valor) {
    setNit(valor.replace(/\D/g, ''))
    setRazonSocial('')
  }

  function seleccionarCliente(cliente) {
    setNit(cliente.nit)
    setRazonSocial(cliente.razon_social)
    setSugerencias([])
    setMostrarSugerencias(false)
    setSinResultados(false)
    onClienteSeleccionado?.(cliente)
  }

  return (
    <div className="cliente-buscador">
      <label className="campo">
        NIT del cliente
        <input
          type="text"
          inputMode="numeric"
          value={nit}
          onChange={(e) => actualizarNit(e.target.value)}
          onFocus={() => sugerencias.length > 0 && setMostrarSugerencias(true)}
          onBlur={() => setTimeout(() => setMostrarSugerencias(false), 150)}
          placeholder="Ej. 123456789"
          autoComplete="off"
        />
      </label>

      {mostrarSugerencias && sugerencias.length > 0 && (
        <ul className="cliente-sugerencias">
          {sugerencias.map((cliente) => (
            <li key={cliente.nit}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => seleccionarCliente(cliente)}
              >
                <strong>{cliente.nit}</strong> — {cliente.razon_social}
              </button>
            </li>
          ))}
        </ul>
      )}

      {buscando && <p className="cliente-estado">Buscando...</p>}
      {!buscando && sinResultados && <p className="error">No se encontró ningún cliente con ese NIT.</p>}

      <label className="campo">
        Razón social
        <input
          type="text"
          value={razonSocial}
          onChange={(e) => setRazonSocial(e.target.value)}
          placeholder="Se completa al elegir un cliente sugerido"
        />
      </label>
    </div>
  )
}

export default ClienteBuscador
