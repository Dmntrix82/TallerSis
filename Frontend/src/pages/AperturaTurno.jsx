import { useState } from 'react'
import { abrirTurno } from '../api/caja.js'

const ESTADO_INICIAL = {
  cajaId: '',
  cajeroId: '',
  efectivoInicial: '',
}

function AperturaTurno() {
  const [datos, setDatos] = useState(ESTADO_INICIAL)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const [turno, setTurno] = useState(null)

  function actualizarCampo(campo, valor) {
    setDatos((prev) => ({ ...prev, [campo]: valor }))
  }

  async function abrir(event) {
    event.preventDefault()

    if (!datos.cajaId || !datos.cajeroId || !datos.efectivoInicial) {
      setError('Complete la caja, el cajero y el monto de efectivo inicial.')
      return
    }

    setEnviando(true)
    setError(null)

    try {
      const respuesta = await abrirTurno({
        caja_id: datos.cajaId,
        cajero_id: datos.cajeroId,
        efectivo_inicial: Number(datos.efectivoInicial),
      })
      setTurno(respuesta.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  function abrirOtroTurno() {
    setDatos(ESTADO_INICIAL)
    setTurno(null)
    setError(null)
  }

  return (
    <section>
      <h1>Apertura de turno</h1>

      {!turno && (
        <form className="turno-form" onSubmit={abrir}>
          <label className="campo">
            Caja
            <input
              type="text"
              value={datos.cajaId}
              onChange={(e) => actualizarCampo('cajaId', e.target.value)}
              placeholder="Ej. CAJA-01"
            />
          </label>

          <label className="campo">
            Cajero
            <input
              type="text"
              value={datos.cajeroId}
              onChange={(e) => actualizarCampo('cajeroId', e.target.value)}
              placeholder="Ej. U-2"
            />
          </label>

          <label className="campo">
            Efectivo inicial (Bs.)
            <input
              type="number"
              step="0.01"
              min="0"
              value={datos.efectivoInicial}
              onChange={(e) => actualizarCampo('efectivoInicial', e.target.value)}
            />
          </label>

          {error && <p className="error">{error}</p>}

          <button type="submit" className="btn" disabled={enviando}>
            {enviando ? 'Abriendo turno...' : 'Abrir turno'}
          </button>
        </form>
      )}

      {turno && (
        <div className="turno-exito">
          <h2>Turno abierto correctamente</h2>
          <ul>
            <li>Turno: {turno.codigo}</li>
            <li>Caja: {turno.caja_id}</li>
            <li>Cajero: {turno.cajero_id}</li>
            <li>Efectivo inicial: Bs. {turno.efectivo_inicial}</li>
            <li>Fecha de apertura: {turno.fecha_apertura}</li>
            <li>Hora de apertura: {turno.hora_apertura}</li>
          </ul>
          <button type="button" className="btn" onClick={abrirOtroTurno}>
            Abrir otro turno
          </button>
        </div>
      )}
    </section>
  )
}

export default AperturaTurno
