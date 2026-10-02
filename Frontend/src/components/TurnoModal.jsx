import { useEffect, useState } from 'react'
import { obtenerTurnoActual } from '../api/turnos.js'
import { abrirTurno } from '../api/caja.js'
import { useAuth } from '../context/AuthContext.jsx'

const FORM_INICIAL = { efectivoInicial: '', supervisorId: '', pin: '' }

// Aparece al entrar a la pantalla principal: avisa si el turno de esta caja
// esta activo o inactivo. Si esta activo, solo se continua. Si esta inactivo,
// exige abrirlo (con usuario + PIN de un supervisor) antes de dejar seguir.
function TurnoModal() {
  const { cajero } = useAuth()
  const [estado, setEstado] = useState('verificando') // verificando | activo | inactivo | abierto
  const [turno, setTurno] = useState(null)
  const [cerrado, setCerrado] = useState(false)
  const [datos, setDatos] = useState(FORM_INICIAL)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!cajero?.caja) return
    let vigente = true

    obtenerTurnoActual(cajero.caja)
      .then((respuesta) => {
        if (!vigente) return
        setTurno(respuesta.data)
        setEstado('activo')
      })
      .catch(() => {
        if (vigente) setEstado('inactivo')
      })

    return () => {
      vigente = false
    }
  }, [cajero?.caja])

  function actualizarCampo(campo, valor) {
    setDatos((prev) => ({ ...prev, [campo]: valor }))
  }

  async function abrir(event) {
    event.preventDefault()

    if (!datos.efectivoInicial) {
      setError('Ingrese el efectivo inicial con el que arranca la caja.')
      return
    }
    if (!datos.supervisorId.trim() || !datos.pin.trim()) {
      setError('Se necesita el usuario y el PIN de un supervisor para habilitar la caja.')
      return
    }

    setEnviando(true)
    setError(null)

    try {
      const respuesta = await abrirTurno({
        caja_id: cajero.caja,
        cajero_id: cajero.nombre,
        efectivo_inicial: Number(datos.efectivoInicial),
        supervisor_id: datos.supervisorId.trim(),
        pin: datos.pin.trim(),
      })
      setTurno(respuesta.data)
      setEstado('abierto')
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  if (cerrado || estado === 'verificando') return null

  return (
    <div className="modal-overlay">
      <div className="modal-caja">
        {estado === 'activo' && (
          <>
            <h2>Turno activo</h2>
            <p>
              La caja {cajero.caja} ya tiene un turno abierto ({turno.codigo}). Puedes continuar
              normalmente.
            </p>
            <button type="button" className="btn" onClick={() => setCerrado(true)}>
              Continuar
            </button>
          </>
        )}

        {estado === 'inactivo' && (
          <>
            <h2>Turno inactivo</h2>
            <p>
              La caja {cajero?.caja} no tiene un turno abierto. Para habilitarla, un supervisor de
              caja debe ingresar su usuario y PIN aquí mismo.
            </p>
            <form onSubmit={abrir}>
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

              <label className="campo">
                Usuario del supervisor
                <input
                  type="text"
                  autoComplete="off"
                  value={datos.supervisorId}
                  onChange={(e) => actualizarCampo('supervisorId', e.target.value)}
                />
              </label>

              <label className="campo">
                PIN del supervisor
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  value={datos.pin}
                  onChange={(e) => actualizarCampo('pin', e.target.value)}
                />
              </label>

              {error && <p className="error">{error}</p>}

              <button type="submit" className="btn" disabled={enviando}>
                {enviando ? 'Abriendo turno...' : 'Abrir turno'}
              </button>
            </form>
          </>
        )}

        {estado === 'abierto' && (
          <>
            <h2>Turno abierto correctamente</h2>
            <ul>
              <li>Turno: {turno.codigo}</li>
              <li>Efectivo inicial: Bs. {turno.efectivo_inicial}</li>
              <li>
                Autorizó: {turno.autorizado_por_nombre} ({turno.autorizado_por})
              </li>
            </ul>
            <button type="button" className="btn" onClick={() => setCerrado(true)}>
              Continuar
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default TurnoModal
