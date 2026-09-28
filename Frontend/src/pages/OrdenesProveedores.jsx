import React, { useState, useEffect } from 'react';
import { obtenerOrdenesPendientes } from '../api/ordenesPago.js';

export default function OrdenesProveedores() {
  const [ordenes, setOrdenes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function cargarOrdenes() {
      try {
        const respuesta = await obtenerOrdenesPendientes();
        setOrdenes(respuesta.data || []);
      } catch (err) {
        setError(err.message || 'Error al cargar las órdenes pendientes');
      } finally {
        setCargando(false);
      }
    }
    cargarOrdenes();
  }, []);

  // TDSI-397:
  const [filtroProveedor, setFiltroProveedor] = useState('');
  const [filtroFecha, setFiltroFecha] = useState('');

  // TDSI-396
  const [ordenSeleccionada, setOrdenSeleccionada] = useState(null);

  // Filtrado reactivo combinado
  const ordenesFiltradas = ordenes.filter((orden) => {
    const coincideProveedor = orden.proveedor
      .toLowerCase()
      .includes(filtroProveedor.toLowerCase());
    const coincideFecha = filtroFecha ? orden.fechaEmision === filtroFecha : true;
    return coincideProveedor && coincideFecha;
  });

  const totalAdeudado = ordenesFiltradas.reduce((acc, curr) => acc + curr.monto, 0);

  const limpiarFiltros = () => {
    setFiltroProveedor('');
    setFiltroFecha('');
  };

  return (
    <div style={{
      maxWidth: '980px',
      margin: '2rem auto',
      padding: '1.5rem',
      backgroundColor: '#ffffff',
      borderRadius: '16px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* TDSI-395 & TDSI-116: */}
      <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>
              Órdenes de Pago a Proveedores
            </h1>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Total por liquidar:</span>
            <strong style={{ fontSize: '1.15rem', color: '#dc2626' }}>Bs. {totalAdeudado.toFixed(2)}</strong>
          </div>
        </div>
      </div>

      {/* TDSI-397: Filtros de búsqueda */}
      <div style={{
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-end',
        flexWrap: 'wrap',
        backgroundColor: '#f8fafc',
        padding: '0.85rem 1rem',
        borderRadius: '10px',
        border: '1px solid #e2e8f0',
        marginBottom: '1.5rem'
      }}>
        <div style={{ flex: '1 1 240px' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '0.3rem' }}>
            🔍 Buscar por proveedor:
          </label>
          <input
            type="text"
            placeholder="Ej. Pil, Embol, Molino..."
            value={filtroProveedor}
            onChange={(e) => setFiltroProveedor(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '0.85rem',
              outline: 'none',
              backgroundColor: '#fff'
            }}
          />
        </div>

        <div style={{ flex: '1 1 180px' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '0.3rem' }}>
            📅 Fecha de emisión:
          </label>
          <input
            type="date"
            value={filtroFecha}
            onChange={(e) => setFiltroFecha(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '0.85rem',
              outline: 'none',
              backgroundColor: '#fff'
            }}
          />
        </div>

        {(filtroProveedor || filtroFecha) && (
          <button
            type="button"
            onClick={limpiarFiltros}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#475569',
              fontSize: '0.8rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Limpiar Filtros
          </button>
        )}
      </div>

      {/* Tabla de órdenes */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ padding: '0.75rem 0.5rem' }}>N° Orden</th>
              <th style={{ padding: '0.75rem 0.5rem' }}>Proveedor</th>
              <th style={{ padding: '0.75rem 0.5rem' }}>Emisión</th>
              <th style={{ padding: '0.75rem 0.5rem' }}>Vencimiento</th>
              <th style={{ padding: '0.75rem 0.5rem' }}>Monto Adeudado</th>
              <th style={{ padding: '0.75rem 0.5rem' }}>Estado</th>
              <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {/* TDSI-398: Mensaje de lista vacía */}
            {ordenesFiltradas.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>
                  ℹ️ No existen órdenes de pago pendientes para los criterios seleccionados.
                </td>
              </tr>
            ) : (
              ordenesFiltradas.map((orden) => (
                <tr key={orden.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.85rem 0.5rem', fontWeight: 'bold', fontFamily: 'monospace', color: '#0f172a' }}>
                    {orden.id}
                  </td>
                  <td style={{ padding: '0.85rem 0.5rem', color: '#1e293b', fontWeight: '500' }}>
                    {orden.proveedor}
                  </td>
                  <td style={{ padding: '0.85rem 0.5rem', color: '#64748b' }}>{orden.fechaEmision}</td>
                  <td style={{ padding: '0.85rem 0.5rem', color: '#b45309', fontWeight: '500' }}>{orden.fechaVencimiento}</td>
                  <td style={{ padding: '0.85rem 0.5rem', fontWeight: 'bold', color: '#dc2626' }}>
                    Bs. {orden.monto.toFixed(2)}
                  </td>
                  <td style={{ padding: '0.85rem 0.5rem' }}>
                    <span style={{
                      backgroundColor: '#fef3c7',
                      color: '#92400e',
                      padding: '0.2rem 0.55rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: '700'
                    }}>
                      Pendiente
                    </span>
                  </td>
                  <td style={{ padding: '0.85rem 0.5rem', textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => setOrdenSeleccionada(orden)}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        color: '#475569',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      Ver Detalle
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* TDSI-396: Modal de detalle expandido */}
      {ordenSeleccionada && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.5)',
          backdropFilter: 'blur(2px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '1.5rem',
            maxWidth: '520px',
            width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>
                  Detalle de Orden: {ordenSeleccionada.id}
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Módulo de Tesorería</span>
              </div>
              <button
                onClick={() => setOrdenSeleccionada(null)}
                style={{ background: 'transparent', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '10px', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div><strong>Proveedor:</strong> {ordenSeleccionada.proveedor}</div>
              <div><strong>NIT Proveedor:</strong> {ordenSeleccionada.nit}</div>
              <div><strong>Concepto:</strong> {ordenSeleccionada.concepto}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                <div><span style={{ color: '#64748b' }}>Fecha Emisión:</span> <br /><strong>{ordenSeleccionada.fechaEmision}</strong></div>
                <div><span style={{ color: '#64748b' }}>Fecha Límite:</span> <br /><strong style={{ color: '#b45309' }}>{ordenSeleccionada.fechaVencimiento}</strong></div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#0f172a' }}>Total Adeudado:</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#dc2626' }}>
                Bs. {ordenSeleccionada.monto.toFixed(2)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setOrdenSeleccionada(null)}
              style={{
                width: '100%',
                padding: '0.65rem',
                backgroundColor: '#0f172a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Cerrar Detalle
            </button>
          </div>
        </div>
      )}
    </div>
  );
}