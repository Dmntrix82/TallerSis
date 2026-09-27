import React, { useState, useEffect } from 'react';

// Datos simulados 
const SOLICITUDES_MOCK = [
  {
    id: 1,
    codigoTransaccion: 'TX-ONLINE-9812',
    cliente: 'Carla Morales V.',
    monto: 450.00,
    fechaSolicitud: '2026-09-26 14:20',
    motivo: 'El cliente solicitó reembolso por cobro duplicado en pasarela web.',
    estado: 'PENDIENTE'
  },
  {
    id: 2,
    codigoTransaccion: 'TX-ONLINE-9815',
    cliente: 'Roberto Gómez P.',
    monto: 1200.50,
    fechaSolicitud: '2026-09-26 15:05',
    motivo: 'Producto agotado en almacén central tras procesar el pago.',
    estado: 'PENDIENTE'
  },
  {
    id: 3,
    codigoTransaccion: 'TX-ONLINE-9801',
    cliente: 'Andrea Fernández',
    monto: 310.00,
    fechaSolicitud: '2026-09-26 11:30',
    motivo: 'Error en monto de facturación por parte del usuario.',
    estado: 'PENDIENTE'
  }
];

export default function AnulacionesOnlinePage() {
  const [solicitudes, setSolicitudes] = useState(SOLICITUDES_MOCK);
  const [cargando, setCargando] = useState(false);
  const [mensajeConfirmacion, setMensajeConfirmacion] = useState(null);

  // CONEXIÓN CON BACKEND: Lista las solicitudes al montar el componente
  useEffect(() => {
    const fetchSolicitudes = async () => {
      try {
        // Descomenta y ajusta la URL cuando el endpoint esté disponible
        /*
        const res = await fetch('http://localhost:8080/api/anulaciones-online/pendientes');
        if (!res.ok) throw new Error('Error al cargar solicitudes');
        const data = await res.json();
        setSolicitudes(data);
        */
      } catch (err) {
        console.error('Error al conectar con backend:', err);
      }
    };

    fetchSolicitudes();
  }, []);

  // TDSI-372 y TDSI-374: Procesar aprobación o rechazo
  const handleProcesar = async (id, nuevoEstado, codigoTx) => {
    setCargando(true);
    setMensajeConfirmacion(null);

    try {
      // CONEXIÓN CON BACKEND: Envío del resultado
      /*
      const res = await fetch(`http://localhost:8080/api/anulaciones-online/${id}/procesar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: nuevoEstado })
      });
      if (!res.ok) throw new Error('Error al procesar anulación');
      */

      // Actualización del estado local
      setSolicitudes(prev => prev.filter(item => item.id !== id));

      const accionTexto = nuevoEstado === 'APROBADA' ? 'aprobada' : 'rechazada';
      setMensajeConfirmacion(`Solicitud para ${codigoTx} fue ${accionTexto} exitosamente.`);

      // Limpia la notificación después de 4 segundos
      setTimeout(() => setMensajeConfirmacion(null), 4000);
    } catch (error) {
      alert('Error de conexión al procesar la solicitud.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '2rem auto', padding: '1rem', fontFamily: 'sans-serif' }}>
      
      {/* Encabezado */}
      <div style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>
          Solicitudes de Anulación - Compras Online (TDSI-15)
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          Gestión y resolución de cancelaciones solicitadas por el Sistema Cliente.
        </p>
      </div>

      {/* TDSI-374: Mensaje de confirmación */}
      {mensajeConfirmacion && (
        <div style={{
          backgroundColor: '#ecfdf5',
          color: '#065f46',
          border: '1px solid #a7f3d0',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          fontSize: '0.875rem',
          fontWeight: '500'
        }}>
          ✓ {mensajeConfirmacion}
        </div>
      )}

      {/* TDSI-371: Lista de solicitudes */}
      {solicitudes.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          backgroundColor: '#f8fafc',
          border: '1px dashed #cbd5e1',
          borderRadius: '8px',
          color: '#64748b'
        }}>
          No hay solicitudes de anulación pendientes por revisar.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {solicitudes.map((item) => (
            <div
              key={item.id}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '1.25rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}
            >
              {/* Encabezado de la tarjeta */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    backgroundColor: '#e0e7ff',
                    color: '#3730a3',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px'
                  }}>
                    {item.codigoTransaccion}
                  </span>
                  <span style={{ marginLeft: '0.75rem', fontSize: '0.875rem', color: '#64748b' }}>
                    {item.fechaSolicitud}
                  </span>
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#0f172a' }}>
                  Bs. {item.monto.toFixed(2)}
                </div>
              </div>

              {/* Datos del cliente */}
              <div style={{ fontSize: '0.875rem', marginBottom: '0.5rem', color: '#334155' }}>
                <strong>Cliente:</strong> {item.cliente}
              </div>

              {/* TDSI-373: Motivo enviado por Sistema Cliente */}
              <div style={{
                backgroundColor: '#fef2f2',
                borderLeft: '4px solid #ef4444',
                padding: '0.6rem 0.8rem',
                borderRadius: '0 6px 6px 0',
                fontSize: '0.85rem',
                color: '#7f1d1d',
                marginBottom: '1rem'
              }}>
                <strong>Motivo de cancelación:</strong> {item.motivo}
              </div>

              {/* TDSI-372: Botones para aprobar o rechazar */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  disabled={cargando}
                  onClick={() => handleProcesar(item.id, 'RECHAZADA', item.codigoTransaccion)}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#475569',
                    padding: '0.4rem 0.9rem',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    cursor: cargando ? 'not-allowed' : 'pointer'
                  }}
                >
                  Rechazar Anulación
                </button>
                <button
                  disabled={cargando}
                  onClick={() => handleProcesar(item.id, 'APROBADA', item.codigoTransaccion)}
                  style={{
                    backgroundColor: '#dc2626',
                    border: 'none',
                    color: '#ffffff',
                    padding: '0.4rem 0.9rem',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    cursor: cargando ? 'not-allowed' : 'pointer'
                  }}
                >
                  Aprobar Anulación
                </button>
              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  );
}