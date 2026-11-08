// TDSI-160/790: vuelto a entregar con el desglose sugerido en fichas de billetes y monedas.
// TDSI-792: si el monto recibido es exacto, se muestra "Sin vuelto".
// El desglose lo calcula el backend y es solo una sugerencia: no cambia como se registra el pago.

// En Bolivia los billetes van de Bs 10 a Bs 200; de ahi para abajo son monedas.
const MENOR_BILLETE = 10

function etiquetaDenominacion(denominacion) {
  return `Bs ${Number.isInteger(denominacion) ? denominacion : denominacion.toFixed(2)}`
}

function DesgloseVuelto({ vuelto, desglose = [] }) {
  if (vuelto === 0) {
    return <p className="vuelto-destacado">Sin vuelto</p>
  }

  return (
    <div className="desglose-vuelto">
      <p className="vuelto-destacado">Vuelto a entregar: Bs. {vuelto.toFixed(2)}</p>
      <p className="desglose-vuelto-titulo">Desglose sugerido</p>
      <ul className="fichas-dinero">
        {desglose.map(({ denominacion, cantidad }) => {
          const esBillete = denominacion >= MENOR_BILLETE
          return (
            <li
              key={denominacion}
              className={`ficha-dinero ${esBillete ? 'ficha-dinero--billete' : 'ficha-dinero--moneda'}`}
              aria-label={`${cantidad} ${esBillete ? 'billete' : 'moneda'}${cantidad === 1 ? '' : 's'} de ${etiquetaDenominacion(denominacion)}`}
            >
              <span className="ficha-dinero-cantidad">{cantidad} ×</span>
              <span className="ficha-dinero-valor">{etiquetaDenominacion(denominacion)}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default DesgloseVuelto
