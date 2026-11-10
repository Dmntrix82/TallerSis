import { useState } from 'react'

// Input de contraseña/PIN con el ojito para mostrar/ocultar (mismo patron que ya
// usaba Login.jsx) -- se usa en toda pantalla con un campo secreto.
export default function CampoPassword({ inputRef, className, ...props }) {
  const [mostrar, setMostrar] = useState(false)

  return (
    <div className={`campo-password${className ? ` ${className}` : ''}`}>
      <input ref={inputRef} type={mostrar ? 'text' : 'password'} {...props} />
      <button
        type="button"
        className="campo-password-boton"
        onClick={() => setMostrar((v) => !v)}
        aria-label={mostrar ? 'Ocultar' : 'Mostrar'}
        tabIndex={-1}
      >
        {mostrar ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a20.3 20.3 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 7 11 7a20.3 20.3 0 0 1-2.68 3.68M14.12 14.12a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        )}
      </button>
    </div>
  )
}
