// functions/test/firestore-rules.notificaciones-config.test.js
//
// Bug real (reportado 2026-08-31, tenant Cocodrilos / gengepardo@gmail.com): guardar la
// configuración desde /configuracion fallaba SIEMPRE con "FirebaseError: Missing or
// insufficient permissions", sin importar qué campo se editara (se reportó al cambiar el logo,
// pero el logo era incidental).
//
// Causa raíz: `obtenerConfiguracionNotificaciones(tenantId)` devolvía CONFIGURACION_POR_DEFECTO
// -- que tenía `tenantId: 'escuela-gajog-001'` HARDCODEADO (constantes.ts) -- cuando el tenant
// todavía no tenía documento en `notificaciones_config`. Ese tenantId ajeno viajaba hasta
// `guardarConfiguracionNotificaciones`, que escribe en `notificaciones_config/{config.tenantId}`
// -- o sea, en el documento de OTRO tenant. La regla exige `currentTenantId() == tenantId` del
// path, así que Firestore rechazaba la escritura, correctamente.
//
// Estos tests fijan el CONTRATO de la regla (no la implementación del cliente): un Admin puede
// escribir la config de SU tenant y nunca la de otro. El fix del cliente (estampar el tenantId
// solicitado sobre el default) se prueba aparte en servicios/configuracionApi.test.ts.

const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const { doc, setDoc } = require("firebase/firestore");

const projectId = "demo-tudojang-notif-config";
const TENANT_PROPIO = "tnt-1770762462159";
const TENANT_AJENO = "escuela-gajog-001";

let environment;

test.before(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: fs.readFileSync(
        path.resolve(__dirname, "..", "..", "firestore.rules"),
        "utf8"
      ),
    },
  });
});

test.beforeEach(async () => {
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "usuarios", "admin-uid"), {
      tenantId: TENANT_PROPIO,
      email: "gengepardo@gmail.com",
      rol: "Admin",
    });
  });
});

test.after(async () => {
  await environment.cleanup();
});

const clienteAdmin = () =>
  environment
    .authenticatedContext("admin-uid", { tenantId: TENANT_PROPIO, rol: "Admin" })
    .firestore();

const CONFIG_BASE = {
  diaCobroMensual: 1,
  diasAnticipoRecordatorio: 5,
  diasGraciaSuspension: 10,
  frecuenciaSyncHoras: 24,
  frecuenciaQueryApiDias: 8,
};

test("Admin PUEDE crear la config de notificaciones de su propio tenant cuando aún no existe", async () => {
  const db = clienteAdmin();

  await assertSucceeds(
    setDoc(
      doc(db, "notificaciones_config", TENANT_PROPIO),
      { ...CONFIG_BASE, tenantId: TENANT_PROPIO },
      { merge: true }
    )
  );
});

test("Admin NO puede escribir la config de notificaciones de OTRO tenant -- este era el rechazo real del bug", async () => {
  const db = clienteAdmin();

  await assertFails(
    setDoc(
      doc(db, "notificaciones_config", TENANT_AJENO),
      { ...CONFIG_BASE, tenantId: TENANT_AJENO },
      { merge: true }
    )
  );
});

test("Admin NO puede escribir en notificaciones_config/PLATFORM_INIT_PENDING (sentinel, no es un tenant real)", async () => {
  const db = clienteAdmin();

  await assertFails(
    setDoc(
      doc(db, "notificaciones_config", "PLATFORM_INIT_PENDING"),
      { ...CONFIG_BASE, tenantId: "PLATFORM_INIT_PENDING" },
      { merge: true }
    )
  );
});
