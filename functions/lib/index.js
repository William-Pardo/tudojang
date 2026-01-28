"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.obtenerContratoPorToken = exports.firmarContrato = exports.generarLinks = void 0;
const admin = require("firebase-admin");
admin.initializeApp();
var generarLinks_1 = require("./contratos/generarLinks");
Object.defineProperty(exports, "generarLinks", { enumerable: true, get: function () { return generarLinks_1.generarLinks; } });
var firmarContrato_1 = require("./contratos/firmarContrato");
Object.defineProperty(exports, "firmarContrato", { enumerable: true, get: function () { return firmarContrato_1.firmarContrato; } });
var obtenerContratoPorToken_1 = require("./contratos/obtenerContratoPorToken");
Object.defineProperty(exports, "obtenerContratoPorToken", { enumerable: true, get: function () { return obtenerContratoPorToken_1.obtenerContratoPorToken; } });
//# sourceMappingURL=index.js.map