const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..");
const indexSource = fs.readFileSync(
  path.join(root, "functions", "index.js"),
  "utf8"
);
const firebaseConfig = JSON.parse(
  fs.readFileSync(path.join(root, "firebase.json"), "utf8")
);
const indexes = JSON.parse(
  fs.readFileSync(path.join(root, "firestore.indexes.json"), "utf8")
);

test("secure ticket callables are exported from Functions", () => {
  assert.match(
    indexSource,
    /exports\.crearTicketSoporteSeguro = functionsV1[\s\S]*?\.https\.onCall\(/
  );
  assert.match(
    indexSource,
    /exports\.actualizarTicketSoporteSeguro = functionsV1[\s\S]*?\.https\.onCall\(/
  );
});

test("ticket persistence and telemetry happen through Admin Firestore", () => {
  assert.match(
    indexSource,
    /collection\("tickets_soporte"\)[\s\S]{0,80}\.add/
  );
  assert.match(
    indexSource,
    /collection\("asistente_telemetria"\)[\s\S]{0,80}\.add/
  );
  assert.doesNotMatch(indexSource, /summary:\s*data\?\.summary/);
});

test("Firebase deploy configuration includes Firestore indexes", () => {
  assert.equal(firebaseConfig.firestore.rules, "firestore.rules");
  assert.equal(firebaseConfig.firestore.indexes, "firestore.indexes.json");
  assert.equal(
    indexes.indexes.some(
      (index) =>
        index.collectionGroup === "tickets_soporte" &&
        index.fields.some((field) => field.fieldPath === "userId") &&
        index.fields.some((field) => field.fieldPath === "status") &&
        index.fields.some((field) => field.fieldPath === "createdAt")
    ),
    true
  );
});
