const ExcelJS = require("exceljs");

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** TDSI-50/749: arma el Excel del Libro de Ventas con las columnas en el orden del formato de Impuestos. */
async function generarLibroVentasExcel({ mes, anio, filas, totales }) {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet(`Libro de Ventas ${mes}-${anio}`);

  hoja.columns = [
    { header: "N°", key: "numero", width: 6 },
    { header: "Fecha", key: "fecha", width: 14 },
    { header: "N° Factura", key: "numero_factura", width: 16 },
    { header: "NIT/CI", key: "nit_ci", width: 16 },
    { header: "Nombre o Razón Social", key: "razon_social", width: 32 },
    { header: "Importe Total", key: "total", width: 14 },
    { header: "Descuento", key: "descuento", width: 12 },
    { header: "Importe Base para el IVA", key: "importe_base", width: 18 },
    { header: "Débito Fiscal (13%)", key: "debito_fiscal", width: 16 },
    { header: "Estado", key: "estado", width: 8 },
  ];
  hoja.getRow(1).font = { bold: true };

  for (const fila of filas) {
    hoja.addRow({
      ...fila,
      fecha: new Date(fila.fecha).toLocaleDateString("es-BO", { timeZone: "America/La_Paz" }),
    });
  }

  const filaTotales = hoja.addRow({
    razon_social: `Totales de ${MESES[mes - 1]} ${anio}`,
    total: totales.total,
    descuento: totales.descuento,
    importe_base: totales.importe_base,
    debito_fiscal: totales.debito_fiscal,
  });
  filaTotales.font = { bold: true };

  return libro.xlsx.writeBuffer();
}

module.exports = { generarLibroVentasExcel };
