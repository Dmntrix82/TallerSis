const dinero = (valor) => `Bs ${(Number(valor) || 0).toFixed(2)}`

// TDSI-59: cuanto queda de las 2 horas para anular o modificar la factura
const textoPlazo = (plazo) => {
  if (!plazo) return null
  if (plazo.vencido) return 'Vencido: pasaron las 2 horas'
  const horas = Math.floor(plazo.minutos_restantes / 60)
  const minutos = plazo.minutos_restantes % 60
  return horas > 0 ? `Quedan ${horas} h ${minutos} min` : `Quedan ${minutos} min`
}
const texto = (valor) => (valor === null || valor === undefined || valor === '' ? '—' : valor)

// TDSI-59: vista previa de la factura dentro de la ventana de autorización del supervisor.
// Los datos salen del resumen del backend; si algún campo no viene, se completa con la
// factura que ya está en la tabla.
export default function ResumenFactura({ resumen, cargando, error, onReintentar, factura, motivo }) {
  // TDSI-910: indicador de carga (skeleton) mientras se consulta el resumen
  if (cargando) {
    return (
      <div className="resumen-factura" aria-busy="true" aria-live="polite" aria-label="Cargando resumen de la factura">
        <div className="resumen-factura-grilla">
          {[1, 2, 3, 4, 5, 6].map((i) => <div className="resumen-factura-skeleton" key={i} />)}
        </div>
        <div className="resumen-factura-skeleton resumen-factura-skeleton-tabla" />
      </div>
    )
  }

  const metodos = resumen?.metodos ?? factura?.metodos
  const documento = resumen?.nit ?? factura?.nit
  const tipoDocumento = resumen?.tipo_documento ?? factura?.tipo_documento
  const fecha = resumen?.fecha ?? factura?.fecha
  const items = resumen?.items ?? resumen?.detalle ?? []

  // TDSI-196 / 911 / 913: N° de factura, fecha y hora, cliente, NIT/CI, total, método, cajero y motivo
  const campos = [
    ['N° de factura', resumen?.numero_factura ?? resumen?.nro_factura ?? resumen?.numero],
    ['Fecha y hora', fecha ? new Date(fecha).toLocaleString() : null],
    ['Cliente', resumen?.razon_social ?? resumen?.cliente ?? factura?.razon_social ?? 'Consumidor final'],
    [tipoDocumento ? `${tipoDocumento}` : 'NIT/CI', documento],
    ['Total', dinero(resumen?.total ?? factura?.total)],
    ['Método de pago', Array.isArray(metodos) ? metodos.join(' + ') : metodos],
    ['Cajero', resumen?.cajero],
    ['Plazo para autorizar', textoPlazo(resumen?.plazo)],
  ]
  const motivoSolicitud = resumen?.motivo ?? motivo

  return (
    <div className="resumen-factura">
      {error && (
        <div className="resumen-factura-error" role="alert">
          <span>{error}</span>
          {onReintentar && (
            <button type="button" className="btn btn-secundario" onClick={onReintentar}>Reintentar</button>
          )}
        </div>
      )}

      <dl className="resumen-factura-grilla">
        {campos.map(([etiqueta, valor]) => (
          <div className="resumen-factura-dato" key={etiqueta}>
            <dt>{etiqueta}</dt>
            <dd>{texto(valor)}</dd>
          </div>
        ))}
        <div className="resumen-factura-dato resumen-factura-motivo">
          <dt>Motivo de la solicitud</dt>
          <dd>{motivoSolicitud ? motivoSolicitud : 'Sin motivo registrado'}</dd>
        </div>
      </dl>

      {/* TDSI-907: ítems con cantidad, precio unitario y subtotal */}
      {!error && (
        <div className="resumen-factura-tabla-contenedor">
          <table className="resumen-factura-tabla">
            <thead>
              <tr>
                <th>Ítem</th>
                <th className="resumen-factura-derecha">Cant.</th>
                <th className="resumen-factura-derecha">Precio</th>
                <th className="resumen-factura-derecha">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="resumen-factura-vacio">Sin ítems registrados</td>
                </tr>
              ) : (
                items.map((item, i) => {
                  const cantidad = Number(item.cantidad) || 0
                  const precio = Number(item.precio_unitario ?? item.precio) || 0
                  const subtotal = item.subtotal ?? item.total ?? cantidad * precio
                  return (
                    <tr key={item.id ?? i}>
                      <td>{texto(item.descripcion ?? item.producto ?? item.nombre)}</td>
                      <td className="resumen-factura-derecha">{cantidad}</td>
                      <td className="resumen-factura-derecha">{dinero(precio)}</td>
                      <td className="resumen-factura-derecha">{dinero(subtotal)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
