const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rules = fs.readFileSync(
  path.resolve(__dirname, "..", "..", "firestore.rules"),
  "utf8"
);

test("clients cannot create, update or delete support tickets", () => {
  assert.match(
    rules,
    /match \/tickets_soporte\/\{ticketId\}[\s\S]*allow create, update, delete: if false;/
  );
});

test("ticket reads require owner tenant or SuperAdmin", () => {
  assert.match(rules, /allow read: if isSuperAdmin\(\) \|\| ownsTicket\(\);/);
  assert.match(rules, /resource\.data\.userId == request\.auth\.uid/);
  assert.match(
    rules,
    /resource\.data\.tenantId == currentTenantId\(\)/
  );
});

test("clients cannot read or write quotas and telemetry", () => {
  assert.match(
    rules,
    /match \/asistente_cuotas\/\{quotaId\}[\s\S]*allow read, write: if false;/
  );
  assert.match(
    rules,
    /match \/asistente_telemetria\/\{eventId\}[\s\S]*allow read, write: if false;/
  );
});

// Fix 2026-07-18 (bug real, mismo patron ya resuelto para sedes): el limite del plan de
// estudiantes (`tenant.limiteEstudiantes`) solo se validaba en el boton de la UI. `create`
// directo del cliente ahora esta bloqueado sin excepcion -- solo la Cloud Function
// `crearEstudiante` (functions/academico/estudiantes.js) puede dar de alta. `update`/
// `delete` NO cambian: siguen gateados por isInstructor(), a diferencia de sedes (que
// bloquea las tres operaciones) porque no hay ningun hallazgo de limite sobre esas dos.
test("clients cannot create students directly -- update/delete stay gated by isInstructor()", () => {
  assert.match(
    rules,
    /match \/estudiantes\/\{docId\}[\s\S]*allow create: if false;[\s\S]*allow update, delete: if isInstructor\(\) && resource\.data\.tenantId == currentTenantId\(\);/
  );
});

// ERR-0011: aislamiento por tenant en las 7 colecciones raiz que se leian/escribian sin
// filtro de tenant (ver bitacora.json). Cada assert.match confirma que la condicion de
// tenant esta presente en el bloque de la coleccion correspondiente -- estos son
// asserts livianos sobre el TEXTO de las reglas; la cobertura de comportamiento real
// (permitir mismo tenant / negar otro tenant) vive en firestore-rules.behavior.test.js.
test("ERR-0011: usuarios list, estudiantes, programas, finanzas, eventos, solicitudesCompra e historialNotificaciones validan tenant", () => {
  assert.match(
    rules,
    /match \/usuarios\/\{uid\}[\s\S]*allow list: if isAdmin\(\) && resource\.data\.tenantId == currentTenantId\(\);/
  );
  assert.match(
    rules,
    /match \/estudiantes\/\{docId\}[\s\S]*allow read: if \(isInstructor\(\) && resource\.data\.tenantId == currentTenantId\(\)\)/
  );
  assert.match(
    rules,
    /match \/programas\/\{docId\}[\s\S]*allow read: if isInstructor\(\) && resource\.data\.tenantId == currentTenantId\(\);/
  );
  assert.match(
    rules,
    /match \/finanzas\/\{docId\}[\s\S]*allow read: if isInstructor\(\) && resource\.data\.tenantId == currentTenantId\(\);/
  );
  assert.match(
    rules,
    /match \/eventos\/\{docId\}[\s\S]*allow read: if \(isInstructor\(\) \|\| isTutor\(\) \|\| isEstudiante\(\)\)\s*\n\s*&& resource\.data\.tenantId == currentTenantId\(\);/
  );
  assert.match(
    rules,
    /match \/solicitudesCompra\/\{docId\}[\s\S]*allow read: if isInstructor\(\) && resource\.data\.tenantId == currentTenantId\(\);/
  );
  assert.match(
    rules,
    /match \/historialNotificaciones\/\{notifId\}[\s\S]*allow read: if \(isInstructor\(\) && resource\.data\.tenantId == currentTenantId\(\)\)/
  );
});
