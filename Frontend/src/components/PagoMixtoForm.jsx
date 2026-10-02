import { useState } from 'react';
import { calcularPagoMixto } from '../api/pagos';

// TDSI-88: División de montos entre 2 métodos de pago. Este componente ya NO
// finaliza el cobro (eso lo hace el formulario principal de Pagos.jsx con el
// botón "Continuar" / "Confirmar cobro"): aquí solo se capturan los montos y
// el botón "Validar montos" únicamente confirma que la suma cuadra con el total.
export default function PagoMixtoForm({ totalVenta = 0, metodo1, metodo2, monto1, monto2, onCambiarMonto1, onCambiarMonto2 }) {
  const [validacion, setValidacion] = useState(null); // { ok, mensaje } | null
  const [validando, setValidando] = useState(false);

  const numMonto1 = parseFloat(monto1) || 0;
  const numMonto2 = parseFloat(monto2) || 0;
  const sumaTotal = +(numMonto1 + numMonto2).toFixed(2);
  const diferencia = +(totalVenta - sumaTotal).toFixed(2);
  const montosCompletos = numMonto1 > 0 && numMonto2 > 0;

  const evitarCaracteresInvalidos = (e) => {
    if (['-', '+', 'e', 'E'].includes(e.key)) e.preventDefault();
  };

  const manejarCambioMonto = (onCambiar) => (e) => {
    const valor = e.target.value;
    if (valor === '' || parseFloat(valor) >= 0) onCambiar(valor);
    setValidacion(null);
  };

  const validarMontos = async (e) => {
    e.preventDefault();
    if (!montosCompletos) return;

    setValidando(true);
    setValidacion(null);

    const payloadCalculo = {
      total: Number(totalVenta.toFixed(2)),
      metodos: [
        { metodo: metodo1, monto: numMonto1 },
        { metodo: metodo2, monto: numMonto2 },
      ],
    };

    try {
      await calcularPagoMixto(payloadCalculo);
      setValidacion({ ok: true, mensaje: 'Los montos son correctos: puede continuar con el cobro.' });
    } catch (error) {
      setValidacion({ ok: false, mensaje: error.mensaje || error.message || 'Los montos no son válidos.' });
    } finally {
      setValidando(false);
    }
  };

  return (
    <div
      style={{
        padding: '1.5rem',
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>
          División de Pago (Pago Mixto)
        </h2>
        <span
          style={{
            fontSize: '0.85rem',
            backgroundColor: '#e0e7ff',
            color: '#3730a3',
            padding: '0.35rem 0.75rem',
            borderRadius: '9999px',
            fontWeight: '700',
          }}
        >
          Total: Bs. {totalVenta.toFixed(2)}
        </span>
      </div>

      <form onSubmit={validarMontos} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Bloque Método 1 */}
        <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '0.4rem' }}>
            Primer Método de Pago
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.5rem' }}>
            <div
              style={{
                padding: '0.55rem',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '0.85rem',
                fontWeight: '600',
                backgroundColor: '#fff',
                color: '#1e293b',
              }}
            >
              {metodo1}
            </div>

            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '10px', top: '9px', fontSize: '0.8rem', fontWeight: 'bold', color: '#94a3b8' }}>Bs.</span>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={monto1}
                onKeyDown={evitarCaracteresInvalidos}
                onChange={manejarCambioMonto(onCambiarMonto1)}
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
            <div
              style={{
                padding: '0.55rem',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '0.85rem',
                fontWeight: '600',
                backgroundColor: '#fff',
                color: '#1e293b',
              }}
            >
              {metodo2}
            </div>

            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '10px', top: '9px', fontSize: '0.8rem', fontWeight: 'bold', color: '#94a3b8' }}>Bs.</span>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={monto2}
                onKeyDown={evitarCaracteresInvalidos}
                onChange={manejarCambioMonto(onCambiarMonto2)}
                style={{ width: '100%', boxSizing: 'border-box', padding: '0.55rem 0.55rem 0.55rem 2rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '600' }}
              />
            </div>
          </div>
        </div>

        {/* Resumen dinámico y validación visual */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            backgroundColor: diferencia === 0 && montosCompletos ? '#ecfdf5' : '#fff1f2',
            border: `1px solid ${diferencia === 0 && montosCompletos ? '#a7f3d0' : '#fecdd3'}`,
          }}
        >
          <div>
            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Suma registrada:</span>
            <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>Bs. {sumaTotal.toFixed(2)}</strong>
          </div>

          <div style={{ textAlign: 'right' }}>
            {diferencia === 0 && montosCompletos ? (
              <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: '700' }}>✓ Montos cuadrados</span>
            ) : (
              <span style={{ fontSize: '0.75rem', color: '#e11d48', fontWeight: '600' }}>
                {diferencia > 0 ? `Faltan Bs. ${diferencia.toFixed(2)}` : `Excede Bs. ${Math.abs(diferencia).toFixed(2)}`}
              </span>
            )}
          </div>
        </div>

        {validacion && (
          <div
            style={{
              backgroundColor: validacion.ok ? '#ecfdf5' : '#fffbeb',
              border: `1px solid ${validacion.ok ? '#a7f3d0' : '#fde68a'}`,
              color: validacion.ok ? '#047857' : '#dc2626',
              padding: '0.65rem 0.85rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: '600',
            }}
          >
            {validacion.ok ? '✓ ' : '⚠️ '}
            {validacion.mensaje}
          </div>
        )}

        <button
          type="submit"
          disabled={!montosCompletos || validando}
          style={{
            marginTop: '0.5rem',
            padding: '0.75rem',
            borderRadius: '10px',
            border: 'none',
            backgroundColor: montosCompletos ? '#4f46e5' : '#cbd5e1',
            color: '#ffffff',
            fontSize: '0.9rem',
            fontWeight: 'bold',
            cursor: montosCompletos && !validando ? 'pointer' : 'not-allowed',
            transition: 'background-color 0.2s',
          }}
        >
          {validando ? 'Validando...' : 'Validar montos'}
        </button>
      </form>
    </div>
  );
}
