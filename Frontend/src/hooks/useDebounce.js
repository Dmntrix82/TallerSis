import { useEffect, useState } from 'react'

export default function useDebounce(valor, retardo = 400) {
  const [valorDebounced, setValorDebounced] = useState(valor)

  useEffect(() => {
    const temporizador = setTimeout(() => setValorDebounced(valor), retardo)
    return () => clearTimeout(temporizador)
  }, [valor, retardo])

  return valorDebounced
}