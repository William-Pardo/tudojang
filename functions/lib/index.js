"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.limpiarDatosPrueba = exports.resetearPasswordAdmin = exports.webhookWompi = exports.obtenerContratoPorToken = exports.firmarContrato = exports.generarLinks = void 0;
const admin = require("firebase-admin");
admin.initializeApp();
var generarLinks_1 = require("./contratos/generarLinks");
Object.defineProperty(exports, "generarLinks", { enumerable: true, get: function () { return generarLinks_1.generarLinks; } });
var firmarContrato_1 = require("./contratos/firmarContrato");
Object.defineProperty(exports, "firmarContrato", { enumerable: true, get: function () { return firmarContrato_1.firmarContrato; } });
var obtenerContratoPorToken_1 = require("./contratos/obtenerContratoPorToken");
Object.defineProperty(exports, "obtenerContratoPorToken", { enumerable: true, get: function () { return obtenerContratoPorToken_1.obtenerContratoPorToken; } });
var webhookWompi_1 = require("./webhookWompi");
Object.defineProperty(exports, "webhookWompi", { enumerable: true, get: function () { return webhookWompi_1.webhookWompi; } });
var resetPassword_1 = require("./resetPassword");
Object.defineProperty(exports, "resetearPasswordAdmin", { enumerable: true, get: function () { return resetPassword_1.resetearPasswordAdmin; } });
var limpiezaDB_1 = require("./limpiezaDB");
Object.defineProperty(exports, "limpiarDatosPrueba", { enumerable: true, get: function () { return limpiezaDB_1.limpiarDatosPrueba; } });
//# sourceMappingURL=index.js.map