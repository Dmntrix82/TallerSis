import { useEffect, useState } from 'react'
import { listarSupervisores, crearSupervisor, restablecerPinSupervisor, cambiarEstadoSupervisor } from '../api/supervisores.js'
import CampoPassword from '../components/CampoPassword.jsx'

const PIN_REGEX = /^\d{4,6}$/
const CLASE_ESTADO = { Activo: 'badge-estado--emitida', Inactivo: '', Bloqueado: 'badge-comparacion--faltante' }
const NUEVO_SUPERVISOR_INICIAL = { usuario: '', nombre: '', pin: '', confirmarPin: '' }

// TDSI-188/725-728: pantalla "Supervisores" del Administrador -- alta, restablecer
// PIN y activar/desactivar, con los mismos supervisores que validan las autorizaciones
// de cierre, anulacion y modificacion en todo el sistema.
function Supervisores() {
  const [supervisores, setSupervisores] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [recargar, setRecargar] = useState(0)
  const [mensaje, setMensaje] = useState(null)

  const [mostrandoNuevo, setMostrandoNuevo] = useState(false)
  const [nuevo, setNuevo] = useState(NUEVO_SUPERVISOR_INICIAL)
  const [creando, setCreando] = useState(false)
  const [errorNuevo, setErrorNuevo] = useState(null)

  const [supervisorPin, setSupervisorPin] = useState(null)
  const [pinNuevo, setPinNuevo] = useState('')
  const [pinConfirmar, setPinConfirmar] = useState('')
  const [restableciendo, setRestableciendo] = useState(false)
  const [errorPin, setErrorPin] = useState(null)

  const [supervisorEstado, setSupervisorEstado] = useState(null) // { id, nombre, activo } del que se va a (des)activar
  const [cambiandoEstado, setCambiandoEstado] = useState(false)
  const [errorEstado, setErrorEstado] = useState(null)

  useEffect(() => {
    let vigente = true
    setCargando(true)
    setError(null)
    listarSupervisores()
      .then((r) => vigente && setSupervisores(r.data))
      .catch((err) => vigente && setError(err.mensaje || err.message))
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [recargar])

  function abrirNuevo() {
    setNuevo(NUEVO_SUPERVISOR_INICIAL)
    setErrorNuevo(null)
    setMostrandoNuevo(true)
    setMensaje(null)
  }

  async function confirmarNuevo(event) {
    event.preventDefault()
    if (!nuevo.usuario.trim() || !nuevo.nombre.trim()) {
      setErrorNuevo('Complete el usuario y el nombre.')
      return
    }
    if (!PIN_REGEX.test(nuevo.pin)) {
      setErrorNuevo('El PIN debe tener entre 4 y 6 dígitos.')
      return
    }
    if (nuevo.pin !== nuevo.confirmarPin) {
      setErrorNuevo('El PIN y su confirmación no coinciden.')
      return
    }
    setCreando(true)
    setErrorNuevo(null)
    try {
      await crearSupervisor({ usuario: nuevo.usuario.trim(), nombre: nuevo.nombre.trim(), pin: nuevo.pin })
      setMostrandoNuevo(false)
      setMensaje({ ok: true, texto: `Supervisor "${nuevo.usuario.trim()}" registrado correctamente.` })
      setRecargar((n) => n + 1)
    } catch (err) {
      setErrorNuevo(err.mensaje || err.message)
    } finally {
      setCreando(false)
    }
  }

  function abrirPin(supervisor) {
    setSupervisorPin(supervisor)
    setPinNuevo('')
    setPinConfirmar('')
    setErrorPin(null)
    setMensaje(null)
  }

  async function confirmarPin(event) {
    event.preventDefault()
    if (!PIN_REGEX.test(pinNuevo)) {
      setErrorPin('El PIN debe tener entre 4 y 6 dígitos.')
      return
    }
    if (pinNuevo !== pinConfirmar) {
      setErrorPin('El PIN y su confirmación no coinciden.')
      return
    }
    setRestableciendo(true)
    setErrorPin(null)
    try {
      await restablecerPinSupervisor(supervisorPin.id, pinNuevo)
      setSupervisorPin(null)
      setMensaje({ ok: true, texto: `PIN de "${supervisorPin.usuario}" restablecido correctamente.` })
      setRecargar((n) => n + 1)
    } catch (err) {
      setErrorPin(err.mensaje || err.message)
    } finally {
      setRestableciendo(false)
    }
  }

  function pedirCambioEstado(supervisor) {
    setSupervisorEstado(supervisor)
    setErrorEstado(null)
    setMensaje(null)
  }

  async function confirmarCambioEstado() {
    setCambiandoEstado(true)
    setErrorEstado(null)
    const activar = !supervisorEstado.activo
    try {
      await cambiarEstadoSupervisor(supervisorEstado.id, activar)
      setSupervisorEstado(null)
      setMensaje({ ok: true, texto: `Supervisor "${supervisorEstado.usuario}" ${activar ? 'activado' : 'desactivado'} correctamente.` })
      setRecargar((n) => n + 1)
    } catch (err) {
      setErrorEstado(err.mensaje || err.message)
    } finally {
      setCambiandoEstado(false)
    }
  }

  return (
    <section>
      <h1>Supervisores</h1>
      <p className="resumen-turno-actual">
        Supervisores de caja que autorizan cierres, anulaciones y modificaciones con su usuario y PIN.
      </p>

      <div className="filtro-fechas">
        <button type="button" className="btn" onClick={abrirNuevo}>
          Nuevo supervisor
        </button>
      </div>

      {mensaje && <p className={mensaje.ok ? 'mensaje-exito' : 'error'}>{mensaje.texto}</p>}

      {cargando && <p>Cargando...</p>}
      {!cargando && error && <p className="error">Error: {error}</p>}

      {!cargando && !error && supervisores.length === 0 && (
        <p className="orden-mensaje orden-mensaje-pendiente cajas-mensaje">Todavía no hay supervisores registrados.</p>
      )}

      {!cargando && !error && supervisores.length > 0 && (
        <table className="tabla-facturas">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Nombre</th>
              <th>Estado</th>
              <th>Actualizado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {supervisores.map((s) => (
              <tr key={s.id}>
                <td>{s.usuario}</td>
                <td>{s.nombre}</td>
                <td>
                  <span className={`badge-estado ${CLASE_ESTADO[s.estado] ?? ''}`}>{s.estado}</span>
                </td>
                <td>{s.actualizado_en ? new Date(s.actualizado_en).toLocaleString() : '—'}</td>
                <td style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-secundario" onClick={() => abrirPin(s)}>
                    Restablecer PIN
                  </button>
                  <button
                    type="button"
                    className={`btn ${s.activo ? 'btn-secundario' : ''}`}
                    onClick={() => pedirCambioEstado(s)}
                  >
                    {s.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {mostrandoNuevo && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Nuevo supervisor">
          <form className="modal-caja" onSubmit={confirmarNuevo}>
            <h2>Nuevo supervisor</h2>

            <label className="campo">
              Usuario
              <input
                type="text"
                autoComplete="off"
                value={nuevo.usuario}
                onChange={(e) => setNuevo((prev) => ({ ...prev, usuario: e.target.value }))}
                autoFocus
              />
            </label>

            <label className="campo">
              Nombre
              <input
                type="text"
                value={nuevo.nombre}
                onChange={(e) => setNuevo((prev) => ({ ...prev, nombre: e.target.value }))}
              />
            </label>

            <label className="campo">
              PIN (4 a 6 dígitos)
              <CampoPassword
                inputMode="numeric"
                autoComplete="new-password"
                value={nuevo.pin}
                onChange={(e) => setNuevo((prev) => ({ ...prev, pin: e.target.value.replace(/\D/g, '') }))}
              />
            </label>

            <label className="campo">
              Confirmar PIN
              <CampoPassword
                inputMode="numeric"
                autoComplete="new-password"
                value={nuevo.confirmarPin}
                onChange={(e) => setNuevo((prev) => ({ ...prev, confirmarPin: e.target.value.replace(/\D/g, '') }))}
              />
            </label>

            {errorNuevo && <p className="error">{errorNuevo}</p>}

            <div className="pago-exito-acciones">
              <button type="button" className="btn btn-secundario" onClick={() => setMostrandoNuevo(false)} disabled={creando}>
                Cancelar
              </button>
              <button type="submit" className="btn" disabled={creando}>
                {creando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {supervisorPin && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Restablecer PIN">
          <form className="modal-caja" onSubmit={confirmarPin}>
            <h2>Restablecer PIN</h2>
            <p>Supervisor: <strong>{supervisorPin.usuario}</strong> ({supervisorPin.nombre})</p>

            <label className="campo">
              PIN nuevo (4 a 6 dígitos)
              <CampoPassword
                inputMode="numeric"
                autoComplete="new-password"
                value={pinNuevo}
                onChange={(e) => setPinNuevo(e.target.value.replace(/\D/g, ''))}
                autoFocus
              />
            </label>

            <label className="campo">
              Confirmar PIN
              <CampoPassword
                inputMode="numeric"
                autoComplete="new-password"
                value={pinConfirmar}
                onChange={(e) => setPinConfirmar(e.target.value.replace(/\D/g, ''))}
              />
            </label>

            {errorPin && <p className="error">{errorPin}</p>}

            <div className="pago-exito-acciones">
              <button type="button" className="btn btn-secundario" onClick={() => setSupervisorPin(null)} disabled={restableciendo}>
                Cancelar
              </button>
              <button type="submit" className="btn" disabled={restableciendo}>
                {restableciendo ? 'Guardando...' : 'Restablecer PIN'}
              </button>
            </div>
          </form>
        </div>
      )}

      {supervisorEstado && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Confirmar cambio de estado">
          <div className="modal-caja">
            <h2>{supervisorEstado.activo ? 'Desactivar' : 'Activar'} supervisor</h2>
            <p>
              ¿Desea {supervisorEstado.activo ? 'desactivar' : 'activar'} a <strong>{supervisorEstado.usuario}</strong> ({supervisorEstado.nombre})?
              {supervisorEstado.activo && ' Mientras esté desactivado no va a poder autorizar nada con su PIN.'}
            </p>

            {errorEstado && <p className="error">{errorEstado}</p>}

            <div className="pago-exito-acciones">
              <button type="button" className="btn btn-secundario" onClick={() => setSupervisorEstado(null)} disabled={cambiandoEstado}>
                Cancelar
              </button>
              <button type="button" className="btn" onClick={confirmarCambioEstado} disabled={cambiandoEstado}>
                {cambiandoEstado ? 'Guardando...' : 'Sí, confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default Supervisores
