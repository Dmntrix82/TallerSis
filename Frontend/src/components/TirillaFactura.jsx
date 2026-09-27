import React, { useState } from 'react';

export default function TirillaFactura({
  venta = {
    id: '0004921',
    fecha: new Date().toLocaleString(),
    cajero: 'Cajero: Rodny Siles',
    cliente: 'Comercializadora Santa Cruz S.R.L.',
    nit: '1029384019',
    items: [
      { nombre: 'Licencia Anual ERP', cantidad: 1, subtotal: 250.00 },
      { nombre: 'Soporte Técnico POS', cantidad: 2, subtotal: 100.00 }
    ],
    total: 350.00,
    metodoPago: 'Pago Dividido (Bs. 200 Efec / Bs. 150 Tarj)'
  }
}) {
  // TDSI-300: Control del modal de vista previa
  const [mostrarModal, setMostrarModal] = useState(false);

  // TDSI-301 y TDSI-302: Estados de retroalimentación
  const [estadoImpresion, setEstadoImpresion] = useState(null); // 'exito' | 'error' | null
  const [simularFallo, setSimularFallo] = useState(false);

  // TDSI-94: Disparador de impresión con control de errores
  const ejecutarImpresion = () => {
    try {
      if (simularFallo) {
        throw new Error('Impresora térmica desconectada o sin papel.');
      }

      // Dispara la impresión nativa
      window.print();

      // TDSI-301: Notificación de confirmación exitosa
      setEstadoImpresion('exito');
      setMostrarModal(false);
      setTimeout(() => setEstadoImpresion(null), 5000);
    } catch (err) {
      // TDSI-302: Notificación de error si la impresora falla
      setEstadoImpresion('error');
    }
  };

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Estilos para que en la hoja solo se imprima la tirilla térmica */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #seccion-imprimible-tirilla, #seccion-imprimible-tirilla * {
            visibility: visible !important;
          }
          #seccion-imprimible-tirilla {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            margin: 0 !important;
            padding: 10px !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* TDSI-299: Botón Imprimir factura en pantalla de venta */}
      <button
        type="button"
        onClick={() => {
          setEstadoImpresion(null);
          setMostrarModal(true);
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '0.65rem 1.25rem',
          backgroundColor: '#0f172a',
          color: '#ffffff',
          borderRadius: '8px',
          border: 'none',
          fontSize: '0.875rem',
          fontWeight: '600',
          cursor: 'pointer',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}
      >
        <span>🖨️</span>
        <span>Imprimir Factura</span>
      </button>

      {/* TDSI-301: Mensaje de confirmación exitosa */}
      {estadoImpresion === 'exito' && (
        <div style={{
          marginTop: '12px',
          padding: '10px 14px',
          backgroundColor: '#ecfdf5',
          border: '1px solid #a7f3d0',
          borderRadius: '8px',
          color: '#065f46',
          fontSize: '0.85rem',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          ✓ La factura fue enviada e impresa correctamente en la tirilla.
        </div>
      )}

      {/* TDSI-302: Mensaje de error cuando la impresora falla */}
      {estadoImpresion === 'error' && (
        <div style={{
          marginTop: '12px',
          padding: '10px 14px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecdd3',
          borderRadius: '8px',
          color: '#9f1239',
          fontSize: '0.85rem',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          ⚠️ Error: La impresora no responde o no se encuentra conectada al terminal POS.
        </div>
      )}

      {/* TDSI-300: Vista previa de la tirilla (Modal) */}
      {mostrarModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '20px',
            maxWidth: '360px',
            width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#334155' }}>
                Vista Previa de Tirilla
              </span>
              <button
                onClick={() => setMostrarModal(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '1rem', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            {/* CUERPO DE LA TIRILLA (PAPEL TÉRMICO) */}
            <div
              id="seccion-imprimible-tirilla"
              style={{
                backgroundColor: '#fafafa',
                border: '1px solid #cbd5e1',
                padding: '16px',
                borderRadius: '6px',
                fontFamily: "'Courier New', Courier, monospace",
                fontSize: '0.78rem',
                color: '#111827',
                lineHeight: '1.4'
              }}
            >
              <div style={{ textAlign: 'center', borderBottom: '1px dashed #64748b', paddingBottom: '8px', marginBottom: '8px' }}>
                <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>SUPERMERCADOS TDSI S.A.</div>
                <div>Casa Matriz: Av. 6 de Agosto #2450</div>
                <div>NIT: 102456029 • La Paz - Bolivia</div>
                <div style={{ fontWeight: 'bold', marginTop: '4px' }}>FACTURA ELECTRÓNICA</div>
              </div>

              <div style={{ borderBottom: '1px dashed #64748b', paddingBottom: '8px', marginBottom: '8px' }}>
                <div><strong>N° Factura:</strong> {venta.id}</div>
                <div><strong>Fecha:</strong> {venta.fecha}</div>
                <div><strong>{venta.cajero}</strong></div>
                <div><strong>NIT/CI:</strong> {venta.nit}</div>
                <div><strong>Señor(es):</strong> {venta.cliente}</div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px dashed #64748b', textAlign: 'left', fontSize: '0.75rem' }}>
                    <th style={{ paddingBottom: '4px' }}>Cant</th>
                    <th style={{ paddingBottom: '4px' }}>Detalle</th>
                    <th style={{ textAlign: 'right', paddingBottom: '4px' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {venta.items.map((item, index) => (
                    <tr key={index}>
                      <td style={{ verticalAlign: 'top', paddingTop: '3px' }}>{item.cantidad}</td>
                      <td style={{ paddingTop: '3px' }}>{item.nombre}</td>
                      <td style={{ textAlign: 'right', verticalAlign: 'top', paddingTop: '3px' }}>
                        Bs. {item.subtotal.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ borderTop: '1px dashed #64748b', paddingTop: '8px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '0.9rem' }}>
                  <span>TOTAL:</span>
                  <span>Bs. {venta.total.toFixed(2)}</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '4px' }}>
                  <strong>Modalidad:</strong> {venta.metodoPago}
                </div>
              </div>

              <div style={{ textAlign: 'center', fontSize: '0.7rem', color: '#475569', marginTop: '6px' }}>
                <div>Código Control: 8A-4F-29-C1</div>
                <div>"ESTA FACTURA CONTRIBUYE AL DESARROLLO DEL PAÍS"</div>
                <div style={{ marginTop: '4px' }}>*** GRACIAS POR SU PREFERENCIA ***</div>
              </div>
            </div>

            {/* CONTROLES DEL MODAL */}
            <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              
              {/* TDSI-302: Selector para probar el caso de error */}
              <label style={{ fontSize: '0.75rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={simularFallo}
                  onChange={(e) => setSimularFallo(e.target.checked)}
                />
                Simular fallo de conexión con impresora (TDSI-302)
              </label>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setMostrarModal(false)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    backgroundColor: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    color: '#475569',
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={ejecutarImpresion}
                  style={{
                    flex: 1,
                    padding: '8px',
                    backgroundColor: '#16a34a',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  Imprimir Ahora
                </button>
              </div>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}