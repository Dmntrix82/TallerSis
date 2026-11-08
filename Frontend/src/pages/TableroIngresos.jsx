import { useState } from 'react'
import PanelGeneral from '../components/tablero/PanelGeneral.jsx'
import PanelCajas from '../components/tablero/PanelCajas.jsx'
import PanelMonitoreoCajeros from '../components/tablero/PanelMonitoreoCajeros.jsx'
import PanelRevisionTransacciones from '../components/tablero/PanelRevisionTransacciones.jsx'
import PanelMetodosPago from '../components/tablero/PanelMetodosPago.jsx'
import PanelRecaudado from '../components/tablero/PanelRecaudado.jsx'
import PanelComparacion from '../components/tablero/PanelComparacion.jsx'
import PanelReportes from '../components/tablero/PanelReportes.jsx'

const PESTANAS = [
  { id: 'general', etiqueta: 'General' },
  { id: 'cajas', etiqueta: 'Cajas' },
  { id: 'cajeros', etiqueta: 'Cajeros' },
  { id: 'metodos', etiqueta: 'Métodos de pago' },
  { id: 'recaudado', etiqueta: 'Recaudado' },
  { id: 'comparacion', etiqueta: 'Comparación' },
  { id: 'reportes', etiqueta: 'Reportes' },
]

// Todos los dashboards de supervisión viven aca, cada uno en su pestaña, para no
// repartirlos en un monton de paginas sueltas en el navbar. Cada pestaña solo
// monta (y pide datos) cuando esta activa.
function TableroIngresos() {
  const [pestana, setPestana] = useState('general')

  return (
    <section>
      <h1>Tablero de ingresos</h1>

      <div className="tablero-pestanas" role="tablist" aria-label="Secciones del tablero">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={pestana === p.id}
            className={`tablero-pestana${pestana === p.id ? ' tablero-pestana--activa' : ''}`}
            onClick={() => setPestana(p.id)}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      <div className="tablero-pestana-contenido">
        {pestana === 'general' && <PanelGeneral />}
        {pestana === 'cajas' && <PanelCajas />}
        {pestana === 'cajeros' && (
          <>
            <PanelMonitoreoCajeros />
            <PanelRevisionTransacciones />
          </>
        )}
        {pestana === 'metodos' && <PanelMetodosPago />}
        {pestana === 'recaudado' && <PanelRecaudado />}
        {pestana === 'comparacion' && <PanelComparacion />}
        {pestana === 'reportes' && <PanelReportes />}
      </div>
    </section>
  )
}

export default TableroIngresos
