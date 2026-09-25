import React, { useState } from 'react';

export default function PagoMixtoForm({ totalVenta = 150, onFinalizar }) {
  // TDSI-88: Captura de montos y métodos
  const [metodo1, setMetodo1] = useState('Efectivo');
  const [monto1, setMonto1] = useState('');
  const [metodo2, setMetodo2] = useState('Tarjeta');
  const [monto2, setMonto2] = useState('');

  // Control de flujo: formulario -> resumen -> comprobante
  const [etapa, setEtapa] = useState('formulario');

  const numMonto1 = parseFloat(monto1) || 0;
  const numMonto2 = parseFloat(monto2) || 0;
  const sumaTotal = +(numMonto1 + numMonto2).toFixed(2);
  const diferencia = +(totalVenta - sumaTotal).toFixed(2);

  // TDSI-278: Validaciones
  const montosCompletos = numMonto1 > 0 && numMonto2 > 0;
  const metodosDistintos = metodo1 !== metodo2;
  const cuadraExacto = Math.abs(diferencia) === 0;
  const esValido = montosCompletos && metodosDistintos && cuadraExacto;

  // Bloquear caracteres no numéricos o negativos (- , e, +, E)
  const evitarCaracteresInvalidos = (e) => {
    if (['-', '+', 'e', 'E'].includes(e.key)) {
      e.preventDefault();
    }
  };

  const manejarCambioMonto = (setter) => (e) => {
    const valor = e.target.value;
    if (valor === '' || parseFloat(valor) >= 0) {
      setter(valor);
    }
  };

  const irAResumen = (e) => {
    e.preventDefault();
    if (esValido) setEtapa('resumen');
  };

  const confirmarPago = () => {
    setEtapa('comprobante');
    if (onFinalizar) {
      onFinalizar({
        total: totalVenta,
        metodos: [
          { metodo: metodo1, monto: numMonto1 },
          { metodo: metodo2, monto: numMonto2 }
        ],
        fecha: new Date().toLocaleString()
      });
    }
  };

  const reiniciar = () => {
    setMonto1('');
    setMonto2('');
    setEtapa('formulario');
  };

  // Estilo sutil para estilizar los selects sin romper las clases globales
  const estiloSelect = {
    width: '100%',
    padding: '9px 12px',
    borderRadius: '6px',
    border: '1px solid #ccc',
    backgroundColor: '#ffffff',
    fontSize: '0.95rem',
    color: '#333333',
    cursor: 'pointer',
    outline: 'none',
    boxSizing: 'border-box'
  };

  // VISTA 1: FORMULARIO Y VALIDACIÓN (TDSI-88 & TDSI-278)
  if (etapa === 'formulario') {
    return (
      <div className="pago-form">
        <h2>División de pago (Pago mixto)</h2>
        <p>Total a cobrar: <strong>Bs. {totalVenta.toFixed(2)}</strong></p>

        <form onSubmit={irAResumen}>
          {/* Método 1 */}
          <label className="campo">
            Primer método de pago
            <select
              style={estiloSelect}
              value={metodo1}
              onChange={(e) => setMetodo1(e.target.value)}
            >
              <option value="Efectivo">Efectivo</option>
              <option value="Tarjeta">Tarjeta de Débito / Crédito</option>
              <option value="QR">Pago QR</option>
            </select>
          </label>

          <label className="campo">
            Monto primer método (Bs.)
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={monto1}
              onKeyDown={evitarCaracteresInvalidos}
              onChange={manejarCambioMonto(setMonto1)}
            />
          </label>

          {/* Método 2 */}
          <label className="campo">
            Segundo método de pago
            <select
              style={estiloSelect}
              value={metodo2}
              onChange={(e) => setMetodo2(e.target.value)}
            >
              <option value="Tarjeta">💳 Tarjeta de Débito / Crédito</option>
              <option value="Efectivo">💵 Efectivo</option>
              <option value="QR">📱 Pago QR</option>
            </select>
          </label>

          <label className="campo">
            Monto segundo método (Bs.)
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={monto2}
              onKeyDown={evitarCaracteresInvalidos}
              onChange={manejarCambioMonto(setMonto2)}
            />
          </label>

          {/* Estado de validación */}
          <p>Total ingresado: <strong>Bs. {sumaTotal.toFixed(2)}</strong></p>

          {!metodosDistintos && (
            <p className="error">Debe seleccionar dos métodos de pago diferentes.</p>
          )}

          {metodosDistintos && !cuadraExacto && (numMonto1 > 0 || numMonto2 > 0) && (
            <p className="error">
              {diferencia > 0
                ? `Faltan Bs. ${diferencia.toFixed(2)} para completar el total.`
                : `Los montos exceden el total por Bs. ${Math.abs(diferencia).toFixed(2)}.`
              }
            </p>
          )}

          <button type="submit" className="btn" disabled={!esValido}>
            Continuar
          </button>
        </form>
      </div>
    );
  }

  // VISTA 2: RESUMEN ANTES DE CONFIRMAR (TDSI-264)
  if (etapa === 'resumen') {
    return (
      <div className="pago-resumen">
        <h2>Confirmar cobro mixto</h2>
        <ul>
          <li>{metodo1}: Bs. {numMonto1.toFixed(2)}</li>
          <li>{metodo2}: Bs. {numMonto2.toFixed(2)}</li>
          <li><strong>Total: Bs. {totalVenta.toFixed(2)}</strong></li>
        </ul>

        <div className="pago-acciones">
          <button
            type="button"
            className="btn btn-secundario"
            onClick={() => setEtapa('formulario')}
          >
            Modificar
          </button>
          <button
            type="button"
            className="btn"
            onClick={confirmarPago}
          >
            Confirmar cobro
          </button>
        </div>
      </div>
    );
  }

  // VISTA 3: COMPROBANTE GENERADO (TDSI-265)
  if (etapa === 'comprobante') {
    return (
      <div className="pago-exito">
        <h2>Pago registrado con éxito</h2>
        <ul>
          <li>Desglose {metodo1}: Bs. {numMonto1.toFixed(2)}</li>
          <li>Desglose {metodo2}: Bs. {numMonto2.toFixed(2)}</li>
          <li>Total pagado: Bs. {totalVenta.toFixed(2)}</li>
          <li>Fecha: {new Date().toLocaleString()}</li>
        </ul>

        <button type="button" className="btn" onClick={reiniciar}>
          Registrar otro pago
        </button>
      </div>
    );
  }

  return null;
}