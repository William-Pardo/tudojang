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
