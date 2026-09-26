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
  
  // TDSI-348: Detalle de venta seleccionada (panel modal o expandido)
  const [ventaSeleccionada, setVentaSeleccionada] = useState(null);

  // Filtrado reactivo de transacciones
  const ventasFiltradas = filtroFecha
    ? VENTAS_INICIALES.filter((v) => v.fecha === filtroFecha)
    : VENTAS_INICIALES;

  return (
    <section className="pago-form" style={{ maxWidth: '750px', margin: '0 auto' }}>
      {/* TDSI-347: Pantalla donde el administrador ve las ventas online recibidas */}
      <h1>Ventas Online Recibidas</h1>
      <p>Gestión y sincronización de compras electrónicas</p>

      {/* TDSI-350: Control de filtro por fecha */}
      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <label className="campo" style={{ flex: 1, margin: 0 }}>
          Filtrar por fecha:
          <input
            type="date"
            value={filtroFecha}
            onChange={(e) => setFiltroFecha(e.target.value)}
          />
        </label>
        {filtroFecha && (
          <button
            type="button"
            className="btn btn-secundario"
            onClick={() => setFiltroFecha('')}
            style={{ marginTop: '22px' }}
          >
            Limpiar filtro
          </button>
        )}
      </div>

      {/* Tabla con listado de ventas */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px', textAlign: 'left' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #ccc', backgroundColor: '#f7fafc' }}>
            <th style={{ padding: '8px' }}>N° Orden</th>
            <th style={{ padding: '8px' }}>Fecha</th>
            <th style={{ padding: '8px' }}>Cliente</th>
            <th style={{ padding: '8px' }}>Total</th>
            {/* TDSI-349: Indicador de estado */}
            <th style={{ padding: '8px' }}>Estado</th>
            <th style={{ padding: '8px' }}>Acción</th>
          </tr>
        </thead>
        <tbody>
          {ventasFiltradas.length === 0 ? (
            <tr>
              <td colSpan="6" style={{ padding: '16px', textAlign: 'center', color: '#718096' }}>
                No se encontraron ventas online para la fecha seleccionada.
              </td>
            </tr>
          ) : (
            ventasFiltradas.map((venta) => (
              <tr key={venta.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '8px', fontWeight: 'bold' }}>{venta.id}</td>
                <td style={{ padding: '8px' }}>{venta.fecha}</td>
                <td style={{ padding: '8px' }}>{venta.cliente}</td>
                <td style={{ padding: '8px' }}>Bs. {venta.total.toFixed(2)}</td>
                <td style={{ padding: '8px' }}>
                  {/* TDSI-349: Indicador claro de Recibido correctamente o Error */}
                  {venta.estado === 'completado' ? (
                    <span style={{ color: '#276749', backgroundColor: '#c6f6d5', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '600' }}>
                      ✓ Recibido correctamente
                    </span>
                  ) : (
                    <span style={{ color: '#9b2c2c', backgroundColor: '#fed7d7', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '600' }}>
                      ⚠️ Error
                    </span>
                  )}
                </td>
                <td style={{ padding: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secundario"
                    style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                    onClick={() => setVentaSeleccionada(venta)}
                  >
                    Ver Detalle
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* TDSI-348: Detalle de cada venta online recibida */}
      {ventaSeleccionada && (
        <div className="pago-resumen" style={{ marginTop: '24px' }}>
          <h2>Detalle de Venta: {ventaSeleccionada.id}</h2>
          <ul>
            <li><strong>Cliente:</strong> {ventaSeleccionada.cliente} (NIT/CI: {ventaSeleccionada.nit})</li>
            <li><strong>Fecha:</strong> {ventaSeleccionada.fecha}</li>
            <li><strong>Método de pago:</strong> {ventaSeleccionada.metodo}</li>
            <li>
              <strong>Estado:</strong>{' '}
              {ventaSeleccionada.estado === 'completado' ? 'Recibido correctamente' : `Error (${ventaSeleccionada.motivoError})`}
            </li>
          </ul>

          <h3>Ítems del Pedido</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '14px', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #ccc' }}>
                <th style={{ textAlign: 'left', padding: '6px' }}>Producto</th>
                <th style={{ textAlign: 'center', padding: '6px' }}>Cant.</th>
                <th style={{ textAlign: 'right', padding: '6px' }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {ventaSeleccionada.items.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #edf2f7' }}>
                  <td style={{ padding: '6px' }}>{item.producto}</td>
                  <td style={{ textAlign: 'center', padding: '6px' }}>{item.cantidad}</td>
                  <td style={{ textAlign: 'right', padding: '6px' }}>Bs. {item.subtotal.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>Total Transacción: Bs. {ventaSeleccionada.total.toFixed(2)}</strong>
            <button
              type="button"
              className="btn btn-secundario"
              onClick={() => setVentaSeleccionada(null)}
            >
              Cerrar Detalle
            </button>
          </div>
        </div>
      )}
    </section>
  );
}