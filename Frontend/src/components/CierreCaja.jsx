import React, { useState } from 'react';

export default function CierreCaja({ saldoTeoricoEsperado = 1250.00, onFinalizarCierre }) {
  // TDSI-324: Captura de efectivo contado en físico
  const [efectivoContado, setEfectivoContado] = useState('');
  const [observaciones, setObservaciones] = useState('');

  // Control de flujo: 'formulario' -> 'reporte' (TDSI-325)
  const [etapa, setEtapa] = useState('formulario');

  const contadoNum = parseFloat(efectivoContado) || 0;
  // Diferencia = Contado - Esperado (Positivo = Sobrante, Negativo = Faltante)
  const diferencia = +(contadoNum - saldoTeoricoEsperado).toFixed(2);
  const hayDiferencia = diferencia !== 0 && efectivoContado !== '';

  // Bloqueo de signos negativos
  const evitarCaracteresInvalidos = (e) => {
    if (['-', '+', 'e', 'E'].includes(e.key)) {
      e.preventDefault();
    }
  };

  const ejecutarCierre = (e) => {
    e.preventDefault();
    if (efectivoContado === '') return;

    setEtapa('reporte');
    if (onFinalizarCierre) {
      onFinalizarCierre({
        saldoEsperado: saldoTeoricoEsperado,
        efectivoContado: contadoNum,
        diferencia: diferencia,
        observaciones: observaciones,
        fecha: new Date().toLocaleString()
      });
    }
  };

  const nuevoTurno = () => {
    setEfectivoContado('');
    setObservaciones('');
    setEtapa('formulario');
  };

  // VISTA 1: CAPTURA DE EFECTIVO CONTADO Y ALERTAS (TDSI-324 & TDSI-326)
  if (etapa === 'formulario') {
    return (
      <div className="pago-form">
        <h2>Cierre de Caja y Conciliación</h2>
        <p>Turno actual — Arqueo de efectivo</p>

        <form onSubmit={ejecutarCierre}>
          <label className="campo">
            Saldo esperado en sistema (Bs.)
            <input
              type="text"
              value={`Bs. ${saldoTeoricoEsperado.toFixed(2)}`}
              disabled
              readOnly
            />
          </label>

          {/* TDSI-324: Formulario para ingresar efectivo contado */}
          <label className="campo">
            Efectivo contado en caja (Bs.)
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={efectivoContado}
              onKeyDown={evitarCaracteresInvalidos}
              onChange={(e) => setEfectivoContado(e.target.value)}
              required
            />
          </label>

          <label className="campo">
            Observaciones o justificación
            <textarea
              rows="2"
              placeholder="Notas sobre el cierre o descuadres..."
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              style={{ width: '100%', borderRadius: '6px', border: '1px solid #ccc', padding: '8px', boxSizing: 'border-box' }}
            />
          </label>

          {/* TDSI-326: Alerta visual de descuadre */}
          {hayDiferencia && (
            <p className="error" role="alert">
              {diferencia < 0
                ? `⚠️ Alerta: Existe un faltante de Bs. ${Math.abs(diferencia).toFixed(2)}.`
                : `⚠️ Alerta: Existe un sobrante de Bs. ${diferencia.toFixed(2)}.`
              }
            </p>
          )}

          {efectivoContado !== '' && !hayDiferencia && (
            <p style={{ color: '#276749' }}>
              ✓ Caja conciliada perfectamente (Sin diferencias).
            </p>
          )}

          {/* TDSI-323: Acción de confirmar cierre */}
          <button
            type="submit"
            className="btn"
            disabled={efectivoContado === ''}
          >
            Realizar Cierre de Caja
          </button>
        </form>
      </div>
    );
  }

  // VISTA 2: REPORTE DE CIERRE EN PANTALLA (TDSI-100 & TDSI-325)
  if (etapa === 'reporte') {
    return (
      <div className="pago-resumen">
        <h2>Reporte Consolidado de Cierre de Caja</h2>
        <p>Resumen final del arqueo de turno:</p>

        <ul>
          <li>Fecha y hora: {new Date().toLocaleString()}</li>
          <li>Saldo teórico del sistema: Bs. {saldoTeoricoEsperado.toFixed(2)}</li>
          <li>Efectivo físico contado: Bs. {contadoNum.toFixed(2)}</li>
          <li>
            Diferencia de conciliación:{' '}
            <strong style={{ color: diferencia === 0 ? '#276749' : '#c53030' }}>
              Bs. {diferencia.toFixed(2)} {diferencia < 0 ? '(Faltante)' : diferencia > 0 ? '(Sobrante)' : '(Exacto)'}
            </strong>
          </li>
          {observaciones && <li>Observaciones: {observaciones}</li>}
        </ul>

        <div className="pago-acciones">
          <button type="button" className="btn btn-secundario" onClick={() => window.print()}>
            🖨️ Imprimir Reporte
          </button>
          <button type="button" className="btn" onClick={nuevoTurno}>
            Iniciar Nuevo Turno
          </button>
        </div>
      </div>
    );
  }

  return null;
}