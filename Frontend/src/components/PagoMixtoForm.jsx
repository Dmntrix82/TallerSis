import React, { useState } from 'react';

export default function PagoMixtoForm({ totalVenta = 350.00, onFinalizar }) {
  // TDSI-88: Captura de montos y métodos
  const [metodo1, setMetodo1] = useState('Efectivo');
  const [monto1, setMonto1] = useState('');
  const [metodo2, setMetodo2] = useState('Tarjeta');
  const [monto2, setMonto2] = useState('');

  // Control de flujo: formulario -> resumen -> comprobante
  const [etapa, setEtapa] = useState('formulario');

  // Estados para el envío al backend
  const [enviando, setEnviando] = useState(false);
  const [errorBackend, setErrorBackend] = useState(null);

  const numMonto1 = parseFloat(monto1) || 0;
  const numMonto2 = parseFloat(monto2) || 0;
  const sumaTotal = +(numMonto1 + numMonto2).toFixed(2);
  const diferencia = +(totalVenta - sumaTotal).toFixed(2);

  // TDSI-278: Validaciones
  const montosCompletos = numMonto1 > 0 && numMonto2 > 0;
  const metodosDistintos = metodo1 !== metodo2;
  const cuadraExacto = Math.abs(diferencia) === 0;
  const esValido = montosCompletos && metodosDistintos && cuadraExacto;

  const evitarCaracteresInvalidos = (e) => {
    if (['-', '+', 'e', 'E'].includes(e.key)) e.preventDefault();
  };

  const manejarCambioMonto = (setter) => (e) => {
    const valor = e.target.value;
    if (valor === '' || parseFloat(valor) >= 0) setter(valor);
  };

  const irAResumen = (e) => {
    e.preventDefault();
    if (esValido) setEtapa('resumen');
  };

  const confirmarPago = async () => {
    setEnviando(true);
    setErrorBackend(null);

    // Cálculos de porcentaje requeridos por la tabla pagos.detalles_pago
    const porcentaje1 = Number(((numMonto1 / totalVenta) * 100).toFixed(2));
    const porcentaje2 = Number(((numMonto2 / totalVenta) * 100).toFixed(2));

    // Estructura exacta que requiere registrarPagoMixtoCompleto
    const payload = {
      id_transaccion: 'TX-MIX-' + Date.now(),
      cajaId: 1, // ID por defecto de la terminal POS
      turnoId: 1,
      total: Number(totalVenta.toFixed(2)),
      metodos: [
        {
          metodo: metodo1,
          monto: numMonto1,
          porcentaje: porcentaje1,
          orden: 1,
          referencia: 'Pago Efectivo/POS'
        },
        {
          metodo: metodo2,
          monto: numMonto2,
          porcentaje: porcentaje2,
          orden: 2,
          referencia: 'Pago POS'
        }
      ]
    };

    try {
      // Puerto 4005 de gestion_pagos y endpoint POST /mixto
      const respuesta = await fetch('api/pagos/mixto', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const resultado = await respuesta.json();

      if (!respuesta.ok || !resultado.ok) {
        throw new Error(resultado.mensaje || 'Error al asentar el pago en base de datos');
      }

      console.log('Pago mixto guardado en Supabase con éxito:', resultado.data);
      setEtapa('comprobante');

      if (onFinalizar) {
        onFinalizar(resultado.data);
      }
    } catch (err) {
      console.warn('Backend local no disponible o error:', err.message);
      setErrorBackend(`Servidor no disponible (${err.message}). Avanzando en modo local para pruebas.`);
      // Permite continuar la prueba en la interfaz aunque el backend local esté apagado
      setTimeout(() => setEtapa('comprobante'), 1200);
    } finally {
      setEnviando(false);
    }
  };

  const reiniciar = () => {
    setMonto1('');
    setMonto2('');
    setErrorBackend(null);
    setEtapa('formulario');
  };

  // VISTA 1: FORMULARIO Y VALIDACIÓN (TDSI-88 & TDSI-278)
  if (etapa === 'formulario') {
    return (
      <div style={{
        maxWidth: '520px',
        margin: '1.5rem auto',
        padding: '1.5rem',
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        {/* Cabecera */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>
              División de Pago (Pago Mixto)
            </h2>
          </div>
          <span style={{
            fontSize: '0.85rem',
            backgroundColor: '#e0e7ff',
            color: '#3730a3',
            padding: '0.35rem 0.75rem',
            borderRadius: '9999px',
            fontWeight: '700'
          }}>
            Total: Bs. {totalVenta.toFixed(2)}
          </span>
        </div>

        <form onSubmit={irAResumen} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Bloque Método 1 */}
          <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '0.4rem' }}>
              Primer Método de Pago
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.5rem' }}>
              <select
                value={metodo1}
                onChange={(e) => setMetodo1(e.target.value)}
                style={{ padding: '0.55rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', backgroundColor: '#fff' }}
              >
                <option value="Efectivo">Efectivo</option>
                <option value="Tarjeta">Tarjeta</option>
                <option value="QR">QR Simple</option>
              </select>

              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '10px', top: '9px', fontSize: '0.8rem', fontWeight: 'bold', color: '#94a3b8' }}>Bs.</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={monto1}
                  onKeyDown={evitarCaracteresInvalidos}
                  onChange={manejarCambioMonto(setMonto1)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.55rem 0.55rem 0.55rem 2rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '600' }}
                />
              </div>
            </div>
          </div>

          {/* Bloque Método 2 */}
          <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '0.4rem' }}>
              Segundo Método de Pago
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.5rem' }}>
              <select
                value={metodo2}
                onChange={(e) => setMetodo2(e.target.value)}
                style={{ padding: '0.55rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', backgroundColor: '#fff' }}
              >
                <option value="Tarjeta">💳 Tarjeta</option>
                <option value="Efectivo">💵 Efectivo</option>
                <option value="QR">📱 QR Simple</option>
              </select>

              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '10px', top: '9px', fontSize: '0.8rem', fontWeight: 'bold', color: '#94a3b8' }}>Bs.</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={monto2}
                  onKeyDown={evitarCaracteresInvalidos}
                  onChange={manejarCambioMonto(setMonto2)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.55rem 0.55rem 0.55rem 2rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '600' }}
                />
              </div>
            </div>
          </div>

          {/* Resumen dinámico y validación visual TDSI-278 */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            backgroundColor: cuadraExacto && montosCompletos ? '#ecfdf5' : '#fff1f2',
            border: `1px solid ${cuadraExacto && montosCompletos ? '#a7f3d0' : '#fecdd3'}`
          }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Suma registrada:</span>
              <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>Bs. {sumaTotal.toFixed(2)}</strong>
            </div>

            <div style={{ textAlign: 'right' }}>
              {!metodosDistintos ? (
                <span style={{ fontSize: '0.75rem', color: '#e11d48', fontWeight: '600' }}>Elige métodos distintos</span>
              ) : cuadraExacto && montosCompletos ? (
                <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: '700' }}>✓ Montos cuadrados</span>
              ) : (
                <span style={{ fontSize: '0.75rem', color: '#e11d48', fontWeight: '600' }}>
                  {diferencia > 0 ? `Faltan Bs. ${diferencia.toFixed(2)}` : `Excede Bs. ${Math.abs(diferencia).toFixed(2)}`}
                </span>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={!esValido}
            style={{
              marginTop: '0.5rem',
              padding: '0.75rem',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: esValido ? '#4f46e5' : '#cbd5e1',
              color: '#ffffff',
              fontSize: '0.9rem',
              fontWeight: 'bold',
              cursor: esValido ? 'pointer' : 'not-allowed',
              transition: 'background-color 0.2s'
            }}
          >
            Continuar a Resumen
          </button>
        </form>
      </div>
    );
  }

  // VISTA 2: RESUMEN ANTES DE CONFIRMAR (TDSI-264)
  if (etapa === 'resumen') {
    return (
      <div style={{
        maxWidth: '520px',
        margin: '1.5rem auto',
        padding: '1.5rem',
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem' }}>
          Resumen de Pago Dividido
        </h2>
        <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.25rem' }}>
          Verifica los montos antes de asentar el cobro.
        </p>

        <div style={{ backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.6rem', borderBottom: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
            <span style={{ color: '#475569' }}>{metodo1}</span>
            <strong style={{ color: '#1e293b' }}>Bs. {numMonto1.toFixed(2)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
            <span style={{ color: '#475569' }}>{metodo2}</span>
            <strong style={{ color: '#1e293b' }}>Bs. {numMonto2.toFixed(2)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.75rem', fontSize: '1rem' }}>
            <span style={{ fontWeight: 'bold', color: '#0f172a' }}>Total Cobrado:</span>
            <span style={{ fontWeight: 'bold', color: '#4f46e5' }}>Bs. {totalVenta.toFixed(2)}</span>
          </div>
        </div>

        {/* Aviso de error de backend (modo local) */}
        {errorBackend && (
          <div style={{
            backgroundColor: '#fffbeb',
            border: '1px solid #fde68a',
            color: '#92400e',
            padding: '0.65rem 0.85rem',
            borderRadius: '8px',
            fontSize: '0.78rem',
            marginBottom: '1rem',
            fontWeight: '600'
          }}>
            ⚠️ {errorBackend}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={() => setEtapa('formulario')}
            disabled={enviando}
            style={{
              flex: 1,
              padding: '0.65rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#fff',
              color: '#475569',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: enviando ? 'not-allowed' : 'pointer',
              opacity: enviando ? 0.6 : 1
            }}
          >
            Modificar
          </button>
          <button
            type="button"
            onClick={confirmarPago}
            disabled={enviando}
            style={{
              flex: 2,
              padding: '0.65rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: enviando ? '#94a3b8' : '#16a34a',
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 'bold',
              cursor: enviando ? 'wait' : 'pointer'
            }}
          >
            {enviando ? 'Procesando...' : 'Confirmar Cobro'}
          </button>
        </div>
      </div>
    );
  }

  // VISTA 3: COMPROBANTE GENERADO (TDSI-265)
  if (etapa === 'comprobante') {
    return (
      <div style={{
        maxWidth: '420px',
        margin: '1.5rem auto',
        padding: '1.5rem',
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #cbd5e1',
        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
        fontFamily: "'Courier New', Courier, monospace"
      }}>
        <div style={{ textAlign: 'center', borderBottom: '1px dashed #94a3b8', paddingBottom: '1rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🧾</div>
          <h3 style={{ fontSize: '1rem', fontWeight: 'bold', margin: 0 }}>COMPROBANTE DE PAGO</h3>
          <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.2rem 0' }}>MODALIDAD MIXTA</p>
          <p style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{new Date().toLocaleString()}</p>
        </div>

        <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', borderBottom: '1px dashed #94a3b8', paddingBottom: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>• {metodo1}:</span>
            <strong>Bs. {numMonto1.toFixed(2)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>• {metodo2}:</span>
            <strong>Bs. {numMonto2.toFixed(2)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', fontWeight: 'bold', marginTop: '0.25rem' }}>
            <span>TOTAL PAGADO:</span>
            <span>Bs. {totalVenta.toFixed(2)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={reiniciar}
          style={{
            width: '100%',
            padding: '0.65rem',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: '#0f172a',
            color: '#fff',
            fontSize: '0.85rem',
            fontFamily: 'system-ui, sans-serif',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          Registrar Otro Cobro
        </button>
      </div>
    );
  }

  return null;
}