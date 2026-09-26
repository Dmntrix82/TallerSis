import React, { useState } from 'react';

export default function TirillaFactura({
  venta = {
    id: 1042,
    fecha: new Date().toLocaleString(),
    cajero: 'Caja 01',
    cliente: 'Consumidor Final',
    nit: '0',
    items: [
      { nombre: 'Leche Pil 1L', cantidad: 2, subtotal: 14.00 },
      { nombre: 'Pan de Molde', cantidad: 1, subtotal: 12.50 },
      { nombre: 'Galletas Mabel', cantidad: 3, subtotal: 18.00 }
    ],
    total: 44.50,
    metodoPago: 'Efectivo'
  }
}) {
  // TDSI-300: Control del modal de vista previa
  const [mostrarModal, setMostrarModal] = useState(false);

  // TDSI-301 y TDSI-302: Estados de retroalimentación
  const [estadoImpresion, setEstadoImpresion] = useState(null); // 'exito' | 'error' | null
  const [simularFallo, setSimularFallo] = useState(false);

  // TDSI-94: Disparador de impresión
  const ejecutarImpresion = () => {
    try {
      if (simularFallo) {
        throw new Error('No se detectó respuesta de la impresora térmica.');
      }

      // Abre el diálogo nativo de impresión del sistema
      window.print();

      // TDSI-301: Notificación de confirmación exitosa
      setEstadoImpresion('exito');
      setMostrarModal(false);
    } catch (err) {
      // TDSI-302: Notificación de error si la impresora falla o está desconectada
      setEstadoImpresion('error');
    }
  };

  const estiloModalOverlay = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999
  };

  const estiloTirilla = {
    width: '300px',
    backgroundColor: '#ffffff',
    padding: '20px',
    borderRadius: '4px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    fontFamily: 'monospace',
    color: '#000000',
    fontSize: '0.85rem'
  };

  return (
    <div className="tirilla-container" style={{ margin: '20px 0' }}>
      {/* TDSI-299: Botón Imprimir factura en pantalla de venta */}
      <button
        type="button"
        className="btn"
        onClick={() => {
          setEstadoImpresion(null);
          setMostrarModal(true);
        }}
      >
        🖨️ Imprimir factura
      </button>

      {/* TDSI-301: Confirmación de éxito */}
      {estadoImpresion === 'exito' && (
        <p style={{ color: '#276749', marginTop: '10px' }} role="status">
          ✓ La impresión de la tirilla se completó con éxito.
        </p>
      )}

      {/* TDSI-302: Alerta de fallo */}
      {estadoImpresion === 'error' && (
        <p className="error" style={{ marginTop: '10px' }} role="alert">
          ⚠️ Error: La impresora no responde o está desconectada.
        </p>
      )}

      {/* TDSI-300: Vista previa de la tirilla (Modal) */}
      {mostrarModal && (
        <div style={estiloModalOverlay}>
          <div style={estiloTirilla}>
            <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '8px' }}>
              <strong>SUPERMERCADO CENTRAL</strong>
              <div>Sucursal Central - La Paz</div>
              <div>NIT: 1029384756</div>
              <div>Factura N°: {venta.id}</div>
            </div>

            <div style={{ margin: '10px 0', fontSize: '0.75rem' }}>
              <div>Fecha: {venta.fecha}</div>
              <div>Cajero: {venta.cajero}</div>
              <div>Cliente: {venta.cliente}</div>
              <div>NIT/CI: {venta.nit}</div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px dashed #000', textAlign: 'left' }}>
                  <th>Cant</th>
                  <th>Detalle</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {venta.items.map((item, index) => (
                  <tr key={index}>
                    <td>{item.cantidad}</td>
                    <td>{item.nombre}</td>
                    <td style={{ textAlign: 'right' }}>Bs. {item.subtotal.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ borderTop: '1px dashed #000', paddingTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                <span>TOTAL:</span>
                <span>Bs. {venta.total.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginTop: '4px' }}>
                <span>Forma de Pago:</span>
                <span>{venta.metodoPago}</span>
              </div>
            </div>

            <div style={{ textAlign: 'center', margin: '12px 0 6px', fontSize: '0.7rem' }}>
              *** GRACIAS POR SU COMPRA ***
            </div>

            {/* Opciones del modal */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
              <label style={{ fontSize: '0.75rem', color: '#4a5568' }}>
                <input
                  type="checkbox"
                  checked={simularFallo}
                  onChange={(e) => setSimularFallo(e.target.checked)}
                />{' '}
                Simular fallo de impresora (TDSI-302)
              </label>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secundario"
                  style={{ flex: 1 }}
                  onClick={() => setMostrarModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{ flex: 1 }}
                  onClick={ejecutarImpresion}
                >
                  Imprimir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}