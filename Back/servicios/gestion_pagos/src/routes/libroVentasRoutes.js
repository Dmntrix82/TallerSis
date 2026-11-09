const { Router } = require("express");
const { obtenerLibroVentas } = require("../services/libroVentasService");
const { generarLibroVentasExcel } = require("../services/libroVentasExcelService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-50/748: vista previa (filas + totales) que arma la pantalla del Administrador.
router.get("/", wrap(async (req, res) => {
  const libro = await obtenerLibroVentas(req.query.mes, req.query.anio);
  res.json(libro);
}));

// TDSI-50/749: el boton "Descargar Libro de Ventas" baja el Excel con las mismas filas.
router.get("/excel", wrap(async (req, res) => {
  const libro = await obtenerLibroVentas(req.query.mes, req.query.anio);
  const buffer = await generarLibroVentasExcel(libro);
  res.set({
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="libro-ventas-${libro.anio}-${String(libro.mes).padStart(2, "0")}.xlsx"`,
  });
  res.send(Buffer.from(buffer));
}));

module.exports = router;
