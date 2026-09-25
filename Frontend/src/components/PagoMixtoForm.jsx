import React, { useState } from 'react';

export default function PagoMixtoForm({ totalVenta = 100 }) {
  const [metodo1, setMetodo1] = useState('efectivo');
  const [monto1, setMonto1] = useState('');
  const [metodo2, setMetodo2] = useState('tarjeta');
  const [monto2, setMonto2] = useState('');

  return (
    <div style={{ maxWidth: '400px', margin: '20px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h3>División de Pago (Pago Mixto)</h3>
      <p><strong>Total de la venta:</strong> Bs. {totalVenta}</p>

      <div style={{ marginBottom: '15px' }}>
        <label>Método 1: </label>
        <select value={metodo1} onChange={(e) => setMetodo1(e.target.value)}>
          <option value="efectivo">Efectivo</option>
          <option value="tarjeta">Tarjeta</option>
          <option value="qr">QR</option>
        </select>
        <input
          type="number"
          placeholder="Monto 1"
          value={monto1}
          onChange={(e) => setMonto1(e.target.value)}
          style={{ marginLeft: '10px', padding: '4px', width: '100px' }}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label>Método 2: </label>
        <select value={metodo2} onChange={(e) => setMetodo2(e.target.value)}>
          <option value="tarjeta">Tarjeta</option>
          <option value="efectivo">Efectivo</option>
          <option value="qr">QR</option>
        </select>
        <input
          type="number"
          placeholder="Monto 2"
          value={monto2}
          onChange={(e) => setMonto2(e.target.value)}
          style={{ marginLeft: '10px', padding: '4px', width: '100px' }}
        />
      </div>

      <div style={{ fontSize: '0.9em', color: '#666' }}>
        Suma ingresada: Bs. {(Number(monto1) + Number(monto2)) || 0}
      </div>
    </div>
  );
}