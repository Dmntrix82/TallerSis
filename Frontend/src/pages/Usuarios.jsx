import { useEffect, useState } from 'react'
import { listarUsuarios, crearCajero, editarUsuario, cambiarPasswordCajero, cambiarEstadoUsuario } from '../api/usuarios.js'
import { useAdminAuth } from '../context/AdminAuthContext.jsx'

const CLASE_ESTADO = { Activo: 'badge-estado--emitida', Inactivo: '', Bloqueado: 'badge-comparacion--faltante' }
const FILTROS_ROL = [
  { valor: '', etiqueta: 'Todos' },
  { valor: 'Cajero', etiqueta: 'Cajeros' },
  { valor: 'Supervisor', etiqueta: 'Supervisores' },
]
const NUEVO_CAJERO_INICIAL = { usuario: '', nombre: '', password: '', confirmarPassword: '' }

// TDSI-172/920-923: pantalla "Usuarios" del Administrador -- cajeros y supervisores
// en una sola lista, con alta de cajeros, edicion y activar/desactivar.
function Usuarios() {
  const { administrador } = useAdminAuth()
  const token = administrador?.access_token

  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [recargar, setRecargar] = useState(0)
  const [filtroRol, setFiltroRol] = useState('')
  const [mensaje, setMensaje] = useState(null)

  const [mostrandoNuevo, setMostrandoNuevo] = useState(false)
  const [nuevo, setNuevo] = useState(NUEVO_CAJERO_INICIAL)
  const [creando, setCreando] = useState(false)
  const [errorNuevo, setErrorNuevo] = useState(null)

  const [editando, setEditando] = useState(null) // usuario seleccionado | null
  const [formEditar, setFormEditar] = useState({ usuario: '', nombre: '' })
  const [cambiarPassword, setCambiarPassword] = useState(false)
  const [passwordNueva, setPasswordNueva] = useState('')
  const [passwordConfirmar, setPasswordConfirmar] = useState('')
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)
  const [errorEditar, setErrorEditar] = useState(null)

  const [cambiandoEstadoDe, setCambiandoEstadoDe] = useState(null) // usuario | null
  const [guardandoEstado, setGuardandoEstado] = useState(false)
  const [errorEstado, setErrorEstado] = useState(null)

  useEffect(() => {
    if (!token) return
    let vigente = true
    setCargando(true)
    setError(null)
    listarUsuarios(token)
      .then((r) => vigente && setUsuarios(r.data))
      .catch((err) => vigente && setError(err.mensaje || err.message))
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [token, recargar])

  const usuariosFiltrados = filtroRol ? usuarios.filter((u) => u.rol === filtroRol) : usuarios

  function abrirNuevo() {
    setNuevo(NUEVO_CAJERO_INICIAL)
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
    if (nuevo.password.length < 6) {
      setErrorNuevo('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (nuevo.password !== nuevo.confirmarPassword) {
      setErrorNuevo('La contraseña y su confirmación no coinciden.')
      return
    }
    setCreando(true)
    setErrorNuevo(null)
    try {
      await crearCajero({ usuario: nuevo.usuario.trim(), nombre: nuevo.nombre.trim(), password: nuevo.password }, token)
      setMostrandoNuevo(false)
      setMensaje({ ok: true, texto: `Cajero "${nuevo.usuario.trim()}" registrado correctamente.` })
      setRecargar((n) => n + 1)
    } catch (err) {
      setErrorNuevo(err.mensaje || err.message)
    } finally {
      setCreando(false)
    }
  }

  function abrirEditar(usuario) {
    setEditando(usuario)
    setFormEditar({ usuario: usuario.usuario, nombre: usuario.nombre })
    setCambiarPassword(false)
    setPasswordNueva('')
    setPasswordConfirmar('')
    setErrorEditar(null)
    setMensaje(null)
  }

  async function confirmarEditar(event) {
    event.preventDefault()
    if (!formEditar.usuario.trim() || !formEditar.nombre.trim()) {
      setErrorEditar('Complete el usuario y el nombre.')
      return
    }
    if (editando.rol === 'Cajero' && cambiarPassword) {
      if (passwordNueva.length < 6) {
        setErrorEditar('La contraseña debe tener al menos 6 caracteres.')
        return
      }
      if (passwordNueva !== passwordConfirmar) {
        setErrorEditar('La contraseña y su confirmación no coinciden.')
        return
      }
    }

    setGuardandoEdicion(true)
    setErrorEditar(null)
    try {
      await editarUsuario(editando.id, { usuario: formEditar.usuario.trim(), nombre: formEditar.nombre.trim() }, token)
      if (editando.rol === 'Cajero' && cambiarPassword) {
        await cambiarPasswordCajero(editando.id, passwordNueva, token)
      }
      setEditando(null)
      setMensaje({ ok: true, texto: `Usuario "${formEditar.usuario.trim()}" actualizado correctamente.` })
      setRecargar((n) => n + 1)
    } catch (err) {
      setErrorEditar(err.mensaje || err.message)
    } finally {
      setGuardandoEdicion(false)
    }
  }

  function pedirCambioEstado(usuario) {
    setCambiandoEstadoDe(usuario)
    setErrorEstado(null)
    setMensaje(null)
  }

  async function confirmarCambioEstado() {
    setGuardandoEstado(true)
    setErrorEstado(null)
    const activar = cambiandoEstadoDe.estado !== 'Activo'
    try {
      await cambiarEstadoUsuario(cambiandoEstadoDe.id, activar, token)
      setMensaje({ ok: true, texto: `Usuario "${cambiandoEstadoDe.usuario}" ${activar ? 'activado' : 'desactivado'} correctamente.` })
      setCambiandoEstadoDe(null)
      setRecargar((n) => n + 1)
    } catch (err) {
      setErrorEstado(err.mensaje || err.message)
    } finally {
      setGuardandoEstado(false)
    }
  }

  return (
    <section>
      <h1>Usuarios</h1>
      <p className="resumen-turno-actual">Cuentas de cajeros y supervisores que usan el sistema.</p>

      <div className="filtro-fechas">
        <label className="campo campo-turno-dia">
          Rol
          <select value={filtroRol} onChange={(e) => setFiltroRol(e.target.value)}>
            {FILTROS_ROL.map((o) => (
              <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
            ))}
          </select>
        </label>
        <button type="button" className="btn" onClick={abrirNuevo}>
          Nuevo cajero
        </button>
      </div>

      {mensaje && <p className={mensaje.ok ? 'mensaje-exito' : 'error'}>{mensaje.texto}</p>}

      {cargando && <p>Cargando...</p>}
      {!cargando && error && <p className="error">Error: {error}</p>}

      {!cargando && !error && usuariosFiltrados.length === 0 && (
        <p className="orden-mensaje orden-mensaje-pendiente cajas-mensaje">No hay usuarios que coincidan con el filtro.</p>
      )}

      {!cargando && !error && usuariosFiltrados.length > 0 && (
        <table className="tabla-facturas">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Nombre</th>
              <th>Rol</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {usuariosFiltrados.map((u) => (
              <tr key={`${u.rol}-${u.id}`}>
                <td>{u.usuario}</td>
                <td>{u.nombre}</td>
                <td>{u.rol}</td>
                <td>
                  <span className={`badge-estado ${CLASE_ESTADO[u.estado] ?? ''}`}>{u.estado}</span>
                </td>
                <td style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-secundario" onClick={() => abrirEditar(u)}>
                    Editar
                  </button>
                  <button
                    type="button"
                    className={`btn ${u.estado === 'Activo' ? 'btn-secundario' : ''}`}
                    onClick={() => pedirCambioEstado(u)}
                  >
                    {u.estado === 'Activo' ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {mostrandoNuevo && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Nuevo cajero">
          <form className="modal-caja" onSubmit={confirmarNuevo}>
            <h2>Nuevo cajero</h2>

            <label className="campo">
              Usuario (correo)
              <input
                type="email"
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
              Contraseña (mínimo 6 caracteres)
              <input
                type="password"
                autoComplete="new-password"
                value={nuevo.password}
                onChange={(e) => setNuevo((prev) => ({ ...prev, password: e.target.value }))}
              />
            </label>

            <label className="campo">
              Confirmar contraseña
              <input
                type="password"
                autoComplete="new-password"
                value={nuevo.confirmarPassword}
                onChange={(e) => setNuevo((prev) => ({ ...prev, confirmarPassword: e.target.value }))}
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

      {editando && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Editar usuario">
          <form className="modal-caja" onSubmit={confirmarEditar}>
            <h2>Editar {editando.rol.toLowerCase()}</h2>

            <label className="campo">
              Usuario
              <input
                type="text"
                autoComplete="off"
                value={formEditar.usuario}
                onChange={(e) => setFormEditar((prev) => ({ ...prev, usuario: e.target.value }))}
                autoFocus
              />
            </label>

            <label className="campo">
              Nombre
              <input
                type="text"
                value={formEditar.nombre}
                onChange={(e) => setFormEditar((prev) => ({ ...prev, nombre: e.target.value }))}
              />
            </label>

            {editando.rol === 'Cajero' && (
              <>
                <div className="factura-correo-acciones" style={{ marginBottom: cambiarPassword ? '1rem' : 0 }}>
                  <button
                    type="button"
                    className={`btn${cambiarPassword ? '' : ' btn-secundario'}`}
                    onClick={() => setCambiarPassword((v) => !v)}
                  >
                    Cambiar contraseña
                  </button>
                </div>

                {cambiarPassword && (
                  <>
                    <label className="campo">
                      Contraseña nueva (mínimo 6 caracteres)
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={passwordNueva}
                        onChange={(e) => setPasswordNueva(e.target.value)}
                      />
                    </label>
                    <label className="campo">
                      Confirmar contraseña
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={passwordConfirmar}
                        onChange={(e) => setPasswordConfirmar(e.target.value)}
                      />
                    </label>
                  </>
                )}
              </>
            )}

            {errorEditar && <p className="error">{errorEditar}</p>}

            <div className="pago-exito-acciones">
              <button type="button" className="btn btn-secundario" onClick={() => setEditando(null)} disabled={guardandoEdicion}>
                Cancelar
              </button>
              <button type="submit" className="btn" disabled={guardandoEdicion}>
                {guardandoEdicion ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {cambiandoEstadoDe && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Confirmar cambio de estado">
          <div className="modal-caja">
            <h2>{cambiandoEstadoDe.estado === 'Activo' ? 'Desactivar' : 'Activar'} usuario</h2>
            <p>
              ¿Desea {cambiandoEstadoDe.estado === 'Activo' ? 'desactivar' : 'activar'} a <strong>{cambiandoEstadoDe.usuario}</strong> ({cambiandoEstadoDe.nombre})?
              {cambiandoEstadoDe.estado === 'Activo' && ' Mientras esté desactivado no va a poder iniciar sesión ni autorizar nada.'}
            </p>

            {errorEstado && <p className="error">{errorEstado}</p>}

            <div className="pago-exito-acciones">
              <button type="button" className="btn btn-secundario" onClick={() => setCambiandoEstadoDe(null)} disabled={guardandoEstado}>
                Cancelar
              </button>
              <button type="button" className="btn" onClick={confirmarCambioEstado} disabled={guardandoEstado}>
                {guardandoEstado ? 'Guardando...' : 'Sí, confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default Usuarios
