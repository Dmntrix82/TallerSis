class AppError extends Error {
  constructor(mensaje, status = 400, detalle = null) {
    super(mensaje);
    this.status = status;
    this.detalle = detalle;
  }
}
module.exports = { AppError };