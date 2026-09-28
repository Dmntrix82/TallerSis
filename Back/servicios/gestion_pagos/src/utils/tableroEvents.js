const { EventEmitter } = require("events");

// TDSI-378: los servicios de pago avisan aqui cuando entra una venta,
// para que el tablero se pueda actualizar en tiempo real sin hacer polling.
const tableroEvents = new EventEmitter();

function emitirActualizacion() {
  tableroEvents.emit("actualizacion");
}

module.exports = { tableroEvents, emitirActualizacion };
