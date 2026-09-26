import React from 'react';
import PagoMixtoForm from '../components/PagoMixtoForm.jsx';

export default function PagoMixto() {
  return (
    <section className="pago-form" style={{ maxWidth: '650px', margin: '0 auto' }}>
      <h1>Gestión de Cobro Mixto</h1>
      <p>Módulo para cobro dividido entre múltiples métodos de pago</p>

      {/* Renderiza tu componente con todas las validaciones y el comprobante */}
      <PagoMixtoForm
        totalVenta={150.00}
        onFinalizar={(datos) => {
          console.log('Pago registrado:', datos);
        }}
      />
    </section>
  );
}