import { useCallback, useEffect, useState } from 'react'
import { obtenerResumenFactura } from '../api/pagos.js'

// TDSI-59: pide el resumen de una factura cuando se abre la ventana de autorización.
// Si `idTransaccion` es null (no hay ventana abierta) no hace nada.
export default function useResumenFactura(idTransaccion) {
  const [resumen, setResumen] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [intento, setIntento] = useState(0)

  const reintentar = useCallback(() => setIntento((n) => n + 1), [])

  useEffect(() => {
    if (!idTransaccion) {
      setResumen(null)
      setError(null)
      setCargando(false)
      return undefined
    }

    let vigente = true // ignora la respuesta si se cerró o cambió la ventana
    setResumen(null)
    setError(null)
    setCargando(true)

    obtenerResumenFactura(idTransaccion)
      .then((respuesta) => {
        if (vigente) setResumen(respuesta?.data ?? respuesta)
      })
      .catch((err) => {
        if (vigente) setError(err?.message || 'No se pudo cargar el resumen de la factura.')
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })

    return () => {
      vigente = false
    }
  }, [idTransaccion, intento])

  return { resumen, cargando, error, reintentar }
}
