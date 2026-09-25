import React, { useState } from 'react';

export default function PagoMixtoForm({ totalVenta = 150, onFinalizar }) {
  // TDSI-88: Captura de montos y métodos
  const [metodo1, setMetodo1] = useState('efectivo');
  const [monto1, setMonto1] = useState('');
  const [metodo2, setMetodo2] = useState('tarjeta');
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

  // VISTA 1: FORMULARIO Y VALIDACIÓN (TDSI-88 & TDSI-278)
  if (etapa === 'formulario') {
    return (
      <section className="pago-mixto-container">
        <h2>División de Pago (Pago Mixto)</h2>
        <p>Total a cobrar: <strong>Bs. {totalVenta.toFixed(2)}</strong></p>

        <form onSubmit={irAResumen}>
          <div>
            <label htmlFor="metodo1">Primer Método:</label>
            <select
              id="metodo1"
              value={metodo1}
              onChange={(e) => setMetodo1(e.target.value)}
            >
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="qr">QR</option>
            </select>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Monto método 1"
              value={monto1}
              onChange={(e) => setMonto1(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="metodo2">Segundo Método:</label>
            <select
              id="metodo2"
              value={metodo2}
              onChange={(e) => setMetodo2(e.target.value)}
            >
              <option value="tarjeta">Tarjeta</option>
              <option value="efectivo">Efectivo</option>
              <option value="qr">QR</option>
            </select>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Monto método 2"
              value={monto2}
              onChange={(e) => setMonto2(e.target.value)}
            />
          </div>

          <div>
            <p>Total ingresado: <strong>Bs. {sumaTotal.toFixed(2)}</strong></p>

            {/* TDSI-278: Mensajes de error y validación */}
            {!metodosDistintos && (
              <p role="alert">⚠️ Los dos métodos deben ser diferentes.</p>
            )}

            {metodosDistintos && !cuadraExacto && (numMonto1 > 0 || numMonto2 > 0) && (
              <p role="alert">
                {diferencia > 0
                  ? `⚠️ Faltan Bs. ${diferencia.toFixed(2)} para completar el total.`
                  : `⚠️ Los montos exceden el total por Bs. ${Math.abs(diferencia).toFixed(2)}.`
                }
              </p>
            )}

            {esValido && (
              <p>✓ Los montos coinciden exactamente con el total.</p>
            )}
          </div>

          <button type="submit" disabled={!esValido}>
            Revisar Resumen
          </button>
        </form>
      </section>
    );
  }

  // VISTA 2: RESUMEN ANTES DE CONFIRMAR (TDSI-264)
  if (etapa === 'resumen') {
    return (
      <section className="resumen-pago">
        <h2>Resumen de Pago Dividido</h2>
        <p>Verifica los montos antes de confirmar:</p>

        <ul>
          <li>{metodo1}: Bs. {numMonto1.toFixed(2)}</li>
          <li>{metodo2}: Bs. {numMonto2.toFixed(2)}</li>
        </ul>

        <p>Total: <strong>Bs. {totalVenta.toFixed(2)}</strong></p>

        <div>
          <button type="button" onClick={() => setEtapa('formulario')}>
            Modificar
          </button>
          <button type="button" onClick={confirmarPago}>
            Confirmar y Cobrar
          </button>
        </div>
      </section>
    );
  }

  // VISTA 3: COMPROBANTE GENERADO (TDSI-265)
  if (etapa === 'comprobante') {
    return (
      <section className="comprobante-pago">
        <h2>¡Pago Realizado con Éxito!</h2>
        <p>Comprobante de Transacción</p>

        <div>
          <p>Desglose {metodo1}: Bs. {numMonto1.toFixed(2)}</p>
          <p>Desglose {metodo2}: Bs. {numMonto2.toFixed(2)}</p>
          <p>Total Pagado: <strong>Bs. {totalVenta.toFixed(2)}</strong></p>
        </div>

        <button type="button" onClick={reiniciar}>
          Registrar Otro Pago
        </button>
      </section>
    );
  }

  return null;
}