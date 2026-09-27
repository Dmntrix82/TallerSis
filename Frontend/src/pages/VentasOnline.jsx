import React, { useState } from 'react';

const VENTAS_INICIALES = [
  {
    id: 'ONL-701',
    cliente: 'Mariana Silva',
    nit: '4920193012',
    fecha: '2026-09-24',
    total: 185.50,
    estado: 'completado', // 'completado' | 'error'
    metodo: 'Transferencia QR',
    items: [
      { producto: 'Aceite Fino 900ml', cantidad: 2, subtotal: 32.00 },
      { producto: 'Arroz Grano de Oro 5kg', cantidad: 1, subtotal: 45.50 },
      { producto: 'Pack Leche Pil 6U', cantidad: 2, subtotal: 108.00 }
    ]
  },
  {
    id: 'ONL-702',
    cliente: 'Carlos Mendoza',
    nit: '1029384',
    fecha: '2026-09-25',
    total: 64.00,
    estado: 'error',
    motivoError: 'Fondos insuficientes en pasarela de pago',
    metodo: 'Tarjeta de Débito',
    items: [
      { producto: 'Detergente Omo 2kg', cantidad: 1, subtotal: 44.00 },
      { producto: 'Lavavajillas Ola 500ml', cantidad: 2, subtotal: 20.00 }
    ]
  },
  {
    id: 'ONL-703',
    cliente: 'Luciana Morales',
    nit: '8392019',
    fecha: '2026-09-26',
    total: 92.00,
    estado: 'completado',
    metodo: 'Pago QR',
    items: [
      { producto: 'Café soluble Nescafé', cantidad: 1, subtotal: 42.00 },
      { producto: 'Galletas surtidas', cantidad: 2, subtotal: 50.00 }
    ]
  }
];

export default function VentasOnline() {
  // TDSI-350: Filtro de búsqueda por fecha
  const [filtroFecha, setFiltroFecha] = useState('');
  
  // TDSI-348: Detalle de venta seleccionada (modal)
  const [ventaSeleccionada, setVentaSeleccionada] = useState(null);

  const ventasFiltradas = filtroFecha
    ? VENTAS_INICIALES.filter((v) => v.fecha === filtroFecha)
    : VENTAS_INICIALES;

  return (
    <div style={{
      maxWidth: '960px',
      margin: '2rem auto',
      padding: '1.5rem',
      backgroundColor: '#ffffff',
      borderRadius: '16px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* TDSI-347: Cabecera administrativa */}
      <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>
              Compras Online Recibidas
            </h1>
          </div>
          <span style={{ fontSize: '0.8rem', backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '0.3rem 0.75rem', borderRadius: '9999px', fontWeight: '600' }}>
            {ventasFiltradas.length} órdenes listadas
          </span>
        </div>
      </div>

      {/* TDSI-350: Barra de filtros */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        backgroundColor: '#f8fafc',
        padding: '0.85rem 1rem',
        borderRadius: '10px',
        border: '1px solid #e2e8f0',
        marginBottom: '1.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>
            📅 Filtrar por fecha:
          </label>
          <input
            type="date"
            value={filtroFecha}
            onChange={(e) => setFiltroFecha(e.target.value)}
            style={{
              padding: '0.45rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '0.85rem',
              outline: 'none',
              backgroundColor: '#ffffff'
            }}
          />
        </div>
        {filtroFecha && (
          <button
            type="button"
            onClick={() => setFiltroFecha('')}
            style={{
              padding: '0.45rem 0.9rem',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#475569',
              fontSize: '0.8rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Limpiar Filtro
          </button>
        )}
      </div>

      {/* Tabla de órdenes */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ padding: '0.75rem 0.5rem' }}>N° Orden</th>
              <th style={{ padding: '0.75rem 0.5rem' }}>Fecha</th>
              <th style={{ padding: '0.75rem 0.5rem' }}>Cliente</th>
              <th style={{ padding: '0.75rem 0.5rem' }}>Total</th>
              <th style={{ padding: '0.75rem 0.5rem' }}>Estado</th>
              <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {ventasFiltradas.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>
                  No se encontraron ventas online para el filtro seleccionado.
                </td>
              </tr>
            ) : (
              ventasFiltradas.map((venta) => (
                <tr key={venta.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.85rem 0.5rem', fontWeight: 'bold', fontFamily: 'monospace', color: '#0f172a' }}>
                    {venta.id}
                  </td>
                  <td style={{ padding: '0.85rem 0.5rem', color: '#64748b' }}>{venta.fecha}</td>
                  <td style={{ padding: '0.85rem 0.5rem', color: '#334155', fontWeight: '500' }}>{venta.cliente}</td>
                  <td style={{ padding: '0.85rem 0.5rem', fontWeight: 'bold', color: '#0f172a' }}>
                    Bs. {venta.total.toFixed(2)}
                  </td>
                  
                  {/* TDSI-349: Indicador claro de estado */}
                  <td style={{ padding: '0.85rem 0.5rem' }}>
                    {venta.estado === 'completado' ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '0.25rem 0.6rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        backgroundColor: '#ecfdf5',
                        color: '#065f46',
                        border: '1px solid #a7f3d0'
                      }}>
                        ✓ Recibido correctamente
                      </span>
                    ) : (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '0.25rem 0.6rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        backgroundColor: '#fef2f2',
                        color: '#991b1b',
                        border: '1px solid #fecdd3'
                      }}>
                        ⚠️ Error en cobro
                      </span>
                    )}
                  </td>

                  {/* TDSI-348: Gatillar vista de detalle */}
                  <td style={{ padding: '0.85rem 0.5rem', textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => setVentaSeleccionada(venta)}
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

      {/* TDSI-348: Modal de detalle expandido */}
      {ventaSeleccionada && (
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
                  Detalle de Venta: {ventaSeleccionada.id}
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Fecha: {ventaSeleccionada.fecha}</span>
              </div>
              <button
                onClick={() => setVentaSeleccionada(null)}
                style={{ background: 'transparent', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '8px', fontSize: '0.825rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div><strong>Cliente:</strong> {ventaSeleccionada.cliente}</div>
              <div><strong>NIT / CI:</strong> {ventaSeleccionada.nit}</div>
              <div><strong>Método de Pago:</strong> {ventaSeleccionada.metodo}</div>
              <div>
                <strong>Estado:</strong>{' '}
                <span style={{ fontWeight: 'bold', color: ventaSeleccionada.estado === 'completado' ? '#059669' : '#dc2626' }}>
                  {ventaSeleccionada.estado === 'completado' ? 'Recibido correctamente' : `Error (${ventaSeleccionada.motivoError})`}
                </span>
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '0.4rem' }}>
                Ítems del Pedido
              </span>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #cbd5e1', textAlign: 'left', color: '#64748b' }}>
                    <th style={{ paddingBottom: '4px' }}>Producto</th>
                    <th style={{ paddingBottom: '4px', textAlign: 'center' }}>Cant.</th>
                    <th style={{ paddingBottom: '4px', textAlign: 'right' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {ventaSeleccionada.items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '6px 0' }}>{item.producto}</td>
                      <td style={{ padding: '6px 0', textAlign: 'center' }}>{item.cantidad}</td>
                      <td style={{ padding: '6px 0', textAlign: 'right' }}>Bs. {item.subtotal.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#0f172a' }}>Total Orden:</span>
              <span style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#2563eb' }}>
                Bs. {ventaSeleccionada.total.toFixed(2)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setVentaSeleccionada(null)}
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