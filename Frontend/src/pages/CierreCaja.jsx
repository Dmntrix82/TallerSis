import React, { useState } from 'react';

export default function CierreCaja({
  saldoTeoricoEsperado = 1450.00,
  cajero = 'Rodny Siles',
  onFinalizarCierre
}) {
  // TDSI-324: Captura de efectivo contado en físico
  const [efectivoContado, setEfectivoContado] = useState('');
  const [observaciones, setObservaciones] = useState('');

  // Control de flujo: 'formulario' -> 'reporte' (TDSI-325)
  const [etapa, setEtapa] = useState('formulario');

  const contadoNum = parseFloat(efectivoContado) || 0;
  // Diferencia = Contado - Esperado (Positivo = Sobrante, Negativo = Faltante)
  const diferencia = +(contadoNum - saldoTeoricoEsperado).toFixed(2);
  const hayDiferencia = diferencia !== 0 && efectivoContado !== '';

  const evitarCaracteresInvalidos = (e) => {
    if (['-', '+', 'e', 'E'].includes(e.key)) e.preventDefault();
  };

  const ejecutarCierre = (e) => {
    e.preventDefault();
    if (efectivoContado === '') return;

    setEtapa('reporte');
    if (onFinalizarCierre) {
      onFinalizarCierre({
        cajero,
        saldoEsperado: saldoTeoricoEsperado,
        efectivoContado: contadoNum,
        diferencia,
        observaciones,
        fecha: new Date().toLocaleString()
      });
    }
  };

  const nuevoTurno = () => {
    setEfectivoContado('');
    setObservaciones('');
    setEtapa('formulario');
  };

  // VISTA 1: FORMULARIO DE CONTEO Y ALERTAS (TDSI-324 & TDSI-326)
  if (etapa === 'formulario') {
    return (
      <div style={{
        maxWidth: '560px',
        margin: '2rem auto',
        padding: '1.75rem',
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        {/* Cabecera */}
        <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>
              Cierre de Turno y Conciliación
            </h2>
            <span style={{ fontSize: '0.75rem', backgroundColor: '#e2e8f0', color: '#475569', padding: '0.2rem 0.6rem', borderRadius: '4px', fontWeight: '600' }}>
              TDSI-9
            </span>
          </div>
        </div>

        <form onSubmit={ejecutarCierre} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Tarjeta Informativa de Saldo Teórico */}
          <div style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: '10px',
            padding: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', fontWeight: '500' }}>
                Saldo Teórico en Sistema (Esperado)
              </span>
              <strong style={{ fontSize: '1.25rem', color: '#0f172a' }}>
                Bs. {saldoTeoricoEsperado.toFixed(2)}
              </strong>
            </div>
          </div>

          {/* TDSI-324: Campo de captura de efectivo */}
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#334155', display: 'block', marginBottom: '0.4rem' }}>
              Efectivo Contado en Gaveta (Bs.) *
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '12px', top: '10px', fontWeight: 'bold', color: '#94a3b8', fontSize: '0.9rem' }}>Bs.</span>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={efectivoContado}
                onKeyDown={evitarCaracteresInvalidos}
                onChange={(e) => setEfectivoContado(e.target.value)}
                required
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '0.65rem 0.65rem 0.65rem 2.5rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '1.1rem',
                  fontWeight: 'bold',
                  color: '#1e293b',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Campo Observaciones */}
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#334155', display: 'block', marginBottom: '0.4rem' }}>
              Observaciones / Justificación de Cuadre
            </label>
            <textarea
              rows="2"
              placeholder="Detalla cualquier ajuste o justificación de descuadre..."
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                padding: '0.6rem',
                fontSize: '0.85rem',
                fontFamily: 'inherit',
                outline: 'none'
              }}
            />
          </div>

          {/* TDSI-326: Alertas dinámicas de descuadre o conciliación */}
          {hayDiferencia && (
            <div style={{
              padding: '0.85rem 1rem',
              borderRadius: '8px',
              backgroundColor: diferencia < 0 ? '#fef2f2' : '#fffbeb',
              border: `1px solid ${diferencia < 0 ? '#fecdd3' : '#fef3c7'}`,
              color: diferencia < 0 ? '#991b1b' : '#92400e',
              fontSize: '0.85rem',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>⚠️</span>
              <span>
                {diferencia < 0
                  ? `Alerta: Existe un faltante de Bs. ${Math.abs(diferencia).toFixed(2)}.`
                  : `Alerta: Existe un sobrante de Bs. ${diferencia.toFixed(2)}.`
                }
              </span>
            </div>
          )}

          {efectivoContado !== '' && !hayDiferencia && (
            <div style={{
              padding: '0.85rem 1rem',
              borderRadius: '8px',
              backgroundColor: '#ecfdf5',
              border: '1px solid #a7f3d0',
              color: '#065f46',
              fontSize: '0.85rem',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>✓</span>
              <span>Caja conciliada exactamente. Sin diferencias monetarias.</span>
            </div>
          )}

          {/* TDSI-323: Botón de confirmación de cierre */}
          <button
            type="submit"
            disabled={efectivoContado === ''}
            style={{
              padding: '0.8rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: efectivoContado !== '' ? '#4f46e5' : '#cbd5e1',
              color: '#ffffff',
              fontSize: '0.9rem',
              fontWeight: 'bold',
              cursor: efectivoContado !== '' ? 'pointer' : 'not-allowed',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              transition: 'background-color 0.2s'
            }}
          >
            Realizar Cierre de Caja
          </button>
        </form>
      </div>
    );
  }

  // VISTA 2: REPORTE CONSOLIDADO EN PANTALLA (TDSI-100 & TDSI-325)
  if (etapa === 'reporte') {
    return (
      <div style={{
        maxWidth: '560px',
        margin: '2rem auto',
        padding: '1.75rem',
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{ borderBottom: '2px dashed #cbd5e1', paddingBottom: '1rem', marginBottom: '1.25rem', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>
            Reporte de Cierre de Caja (Reporte Z)
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.8rem', margin: '0.25rem 0 0 0' }}>
            Comprobante oficial de finalización de turno
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #f1f5f9' }}>
            <span style={{ color: '#64748b' }}>Fecha y Hora:</span>
            <strong>{new Date().toLocaleString()}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #f1f5f9' }}>
            <span style={{ color: '#64748b' }}>Cajero Responsable:</span>
            <strong>{cajero}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #f1f5f9' }}>
            <span style={{ color: '#64748b' }}>Saldo Teórico del Sistema:</span>
            <strong>Bs. {saldoTeoricoEsperado.toFixed(2)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #f1f5f9' }}>
            <span style={{ color: '#64748b' }}>Efectivo Físico Contado:</span>
            <strong>Bs. {contadoNum.toFixed(2)}</strong>
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '0.6rem 0.75rem',
            borderRadius: '8px',
            backgroundColor: diferencia === 0 ? '#ecfdf5' : '#fef2f2',
            fontWeight: 'bold',
            marginTop: '0.25rem'
          }}>
            <span style={{ color: diferencia === 0 ? '#065f46' : '#991b1b' }}>Diferencia de Arqueo:</span>
            <span style={{ color: diferencia === 0 ? '#065f46' : '#991b1b' }}>
              Bs. {diferencia.toFixed(2)} {diferencia < 0 ? '(Faltante)' : diferencia > 0 ? '(Sobrante)' : '(Exacto)'}
            </span>
          </div>
          {observaciones && (
            <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.5rem', backgroundColor: '#f8fafc', padding: '0.6rem', borderRadius: '6px' }}>
              <strong>Notas:</strong> {observaciones}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={() => window.print()}
            style={{
              flex: 1,
              padding: '0.65rem',
              backgroundColor: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              color: '#334155',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            🖨️ Imprimir Reporte
          </button>
          <button
            type="button"
            onClick={nuevoTurno}
            style={{
              flex: 1,
              padding: '0.65rem',
              backgroundColor: '#0f172a',
              border: 'none',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '0.85rem',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Nuevo Turno
          </button>
        </div>
      </div>
    );
  }

  return null;
}