import React, { useState } from 'react';

const ORDENES_INICIALES = [
  {
    id: 'OP-501',
    proveedor: 'Distribuidora PIL Andina S.A.',
    nit: '1020304050',
    monto: 3450.00,
    fechaEmision: '2026-09-20',
    fechaVencimiento: '2026-09-30',
    concepto: 'Lote mensual de lácteos y derivados sucursal central',
    estado: 'pendiente'
  },
  {
    id: 'OP-502',
    proveedor: 'Embotelladora Boliviana (EMBOL)',
    nit: '8090102030',
    monto: 5200.50,
    fechaEmision: '2026-09-22',
    fechaVencimiento: '2026-10-05',
    concepto: 'Reposición de bebidas gaseosas y jugos',
    estado: 'pendiente'
  },
  {
    id: 'OP-503',
    proveedor: 'Molino Andino S.A.',
    nit: '3040506070',
    monto: 1800.00,
    fechaEmision: '2026-09-24',
    fechaVencimiento: '2026-10-02',
    concepto: 'Harina especial y premezclas de panadería',
    estado: 'pendiente'
  }
];

export default function OrdenesPagoProveedores() {
  const [ordenes, setOrdenes] = useState(ORDENES_INICIALES);

  // TDSI-397: Filtros por proveedor y por fecha
  const [filtroProveedor, setFiltroProveedor] = useState('');
  const [filtroFecha, setFiltroFecha] = useState('');

  // TDSI-396: Detalle de orden seleccionada
  const [ordenSeleccionada, setOrdenSeleccionada] = useState(null);

  // Aplicar filtros reactivos
  const ordenesFiltradas = ordenes.filter((orden) => {
    const coincideProveedor = orden.proveedor
      .toLowerCase()
      .includes(filtroProveedor.toLowerCase());
    const coincideFecha = filtroFecha ? orden.fechaEmision === filtroFecha : true;
    return coincideProveedor && coincideFecha;
  });

  const limpiarFiltros = () => {
    setFiltroProveedor('');
    setFiltroFecha('');
  };

  return (
    <section className="pago-form" style={{ maxWidth: '850px', margin: '0 auto' }}>
      {/* TDSI-395 & TDSI-116: Bandeja de órdenes de pago pendientes */}
      <h1>Bandeja de Órdenes de Pago a Proveedores</h1>
      <p>Gestión de pagos pendientes enviados desde el módulo de Compras / ERP</p>

      {/* TDSI-397: Filtros de búsqueda */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <label className="campo" style={{ flex: '1 1 250px', margin: 0 }}>
          Buscar por proveedor:
          <input
            type="text"
            placeholder="Ej. Pil, Embol..."
            value={filtroProveedor}
            onChange={(e) => setFiltroProveedor(e.target.value)}
          />
        </label>

        <label className="campo" style={{ flex: '1 1 180px', margin: 0 }}>
          Filtrar por fecha de emisión:
          <input
            type="date"
            value={filtroFecha}
            onChange={(e) => setFiltroFecha(e.target.value)}
          />
        </label>

        {(filtroProveedor || filtroFecha) && (
          <button
            type="button"
            className="btn btn-secundario"
            onClick={limpiarFiltros}
            style={{ alignSelf: 'flex-end', height: '42px', marginBottom: '2px' }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* TDSI-395: Tabla de listado */}
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #ccc', backgroundColor: '#f7fafc' }}>
            <th style={{ padding: '10px 8px' }}>N° Orden</th>
            <th style={{ padding: '10px 8px' }}>Proveedor</th>
            <th style={{ padding: '10px 8px' }}>Fecha Emisión</th>
            <th style={{ padding: '10px 8px' }}>Monto (Bs.)</th>
            <th style={{ padding: '10px 8px' }}>Estado</th>
            <th style={{ padding: '10px 8px' }}>Acción</th>
          </tr>
        </thead>
        <tbody>
          {/* TDSI-398: Mensaje cuando no hay órdenes pendientes */}
          {ordenesFiltradas.length === 0 ? (
            <tr>
              <td
                colSpan="6"
                style={{
                  padding: '28px 16px',
                  textAlign: 'center',
                  color: '#718096',
                  backgroundColor: '#edf2f7',
                  borderRadius: '6px'
                }}
              >
                ℹ️ No existen órdenes de pago pendientes para los criterios seleccionados.
              </td>
            </tr>
          ) : (
            ordenesFiltradas.map((orden) => (
              <tr key={orden.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '10px 8px', fontWeight: 'bold' }}>{orden.id}</td>
                <td style={{ padding: '10px 8px' }}>{orden.proveedor}</td>
                <td style={{ padding: '10px 8px' }}>{orden.fechaEmision}</td>
                <td style={{ padding: '10px 8px', fontWeight: '600' }}>Bs. {orden.monto.toFixed(2)}</td>
                <td style={{ padding: '10px 8px' }}>
                  <span
                    style={{
                      backgroundColor: '#feebc8',
                      color: '#7b341e',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      fontWeight: 'bold'
                    }}
                  >
                    Pendiente
                  </span>
                </td>
                <td style={{ padding: '10px 8px' }}>
                  <button
                    type="button"
                    className="btn btn-secundario"
                    style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                    onClick={() => setOrdenSeleccionada(orden)}
                  >
                    Ver Detalle
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* TDSI-396: Detalle de cada orden (proveedor, monto, fecha) */}
      {ordenSeleccionada && (
        <div className="pago-resumen" style={{ marginTop: '24px' }}>
          <h2>Detalle de Orden de Pago: {ordenSeleccionada.id}</h2>
          <ul>
            <li><strong>Proveedor:</strong> {ordenSeleccionada.proveedor}</li>
            <li><strong>NIT del Proveedor:</strong> {ordenSeleccionada.nit}</li>
            <li><strong>Concepto / Glosa:</strong> {ordenSeleccionada.concepto}</li>
            <li><strong>Fecha de Emisión:</strong> {ordenSeleccionada.fechaEmision}</li>
            <li><strong>Fecha de Vencimiento:</strong> {ordenSeleccionada.fechaVencimiento}</li>
            <li>
              <strong>Monto Total a Cancelar:</strong>{' '}
              <span style={{ fontSize: '1.1rem', color: '#2b6cb0' }}>
                Bs. {ordenSeleccionada.monto.toFixed(2)}
              </span>
            </li>
          </ul>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button
              type="button"
              className="btn btn-secundario"
              onClick={() => setOrdenSeleccionada(null)}
            >
              Cerrar Detalle
            </button>
          </div>
        </div>
      )}
    </section>
  );
}