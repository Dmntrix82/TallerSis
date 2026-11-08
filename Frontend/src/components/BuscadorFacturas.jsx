export default function BuscadorFacturas({
  valor,
  onChange,
  placeholder = 'Buscar por N° de factura, NIT/CI o cliente',
}) {
  return (
    <div className="buscador-facturas">
      <svg className="buscador-facturas-icono" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="search"
        value={valor}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label="Buscar facturas por número, NIT/CI o nombre del cliente"
        autoComplete="off"
      />
    </div>
  )
}